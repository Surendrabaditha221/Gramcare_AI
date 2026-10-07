"""
Firestore Emergency Service for GramCare AI
Manages persistent Emergency SOS events, family contact notifications,
acknowledgements, status auditing, and device token registration.

Strict Data Integrity Directive:
- Zero demo data / zero fake records.
- Enforces user isolation and authenticated access.
- Zero fake notifications: alerts travel via FCM to actual registered recipient devices.
- If a contact has no registered push device, marks status as 'unavailable' ("Push notifications unavailable").
- Cooldown debounce prevents duplicate alerts caused by repeated button presses.
"""
from datetime import datetime
import logging
import secrets
import hashlib
from typing import Dict, Any, List, Optional
from services.firebase_admin import get_firestore_client
from services.fcm_service import FCMService
from services.email_service import EmailService, normalize_email, is_valid_email

logger = logging.getLogger("gramcare.firestore_emergency")

# In-memory store fallback for offline / test environments
_in_memory_events: Dict[str, Dict[str, Any]] = {}
_in_memory_contacts: Dict[str, Dict[str, Dict[str, Any]]] = {}
_in_memory_tokens: Dict[str, Dict[str, Dict[str, Any]]] = {}


def _generate_event_id() -> str:
    return f"sos_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(4)}"


def _generate_contact_id() -> str:
    return f"ec_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(3)}"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()[:24]


class FirestoreEmergencyService:
    """
    Service for Emergency SOS events, contact notifications, and device token management.
    """

    # ─────────────────────────────────────────────────────────────
    # Emergency Event Management
    # ─────────────────────────────────────────────────────────────

    @classmethod
    async def create_sos_event(
        cls,
        patient_uid: str,
        patient_name: str,
        patient_phone: Optional[str] = None,
        location: Optional[Dict[str, Any]] = None,
        notes: Optional[str] = None,
        severity: str = "CRITICAL",
        target_contact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Creates a new emergency event and triggers push notifications to registered family contacts.
        Includes a 45-second debounce check to prevent duplicate events on frantic button presses.
        Does NOT send alerts to the sender's own device.
        """
        now = datetime.now()
        now_iso = now.isoformat()

        # 1. Debounce Check: Check for recent active SOS within the last 45 seconds (unless targeting a specific contact)
        if not target_contact_id:
            active_alerts = await cls.get_active_patient_alerts(patient_uid)
            for alert in active_alerts:
                st = alert.get("status", "")
                if st.startswith("SOS Initiated") or st in [
                    "Alert Processing",
                    "Notifications Submitted",
                    "Alert Sent",
                    "Delivered to Device",
                    "Notification Opened"
                ]:
                    created_str = alert.get("createdAt")
                    if created_str:
                        try:
                            created_dt = datetime.fromisoformat(created_str)
                            seconds_diff = (now - created_dt).total_seconds()
                            if seconds_diff < 45:
                                logger.info(f"Debounce triggered for patient {patient_uid}. Returning existing event {alert['id']}")
                                # Update location if provided and not previously recorded
                                if location and not alert.get("location"):
                                    await cls.update_event_location(alert["id"], location)
                                    alert["location"] = location
                                    alert["latitude"] = location.get("latitude")
                                    alert["longitude"] = location.get("longitude")
                                return alert
                        except Exception as e:
                            logger.warning(f"Error parsing date during debounce: {e}")

        # 2. Create New Event ID & Audit Base
        event_id = _generate_event_id()
        audit_trail = [
            {
                "status": "SOS Initiated",
                "timestamp": now_iso,
                "updatedBy": patient_uid,
                "notes": "Emergency SOS triggered by patient"
            },
            {
                "status": "Alert Processing",
                "timestamp": now_iso,
                "updatedBy": "System",
                "notes": "Acquiring registered family contacts and dispatching alerts"
            }
        ]

        lat = location.get("latitude") if location else None
        lng = location.get("longitude") if location else None
        acc = location.get("accuracyMeters") if location else None
        if acc is None and location:
            acc = location.get("accuracy")

        loc_avail = bool(lat is not None and lng is not None)

        # 3. Retrieve Emergency Contacts for this Patient
        all_contacts = await cls.list_emergency_contacts(patient_uid)

        if target_contact_id:
            target_contacts = [c for c in all_contacts if c.get("id") == target_contact_id]
        else:
            target_contacts = [c for c in all_contacts if c.get("notifyOnSOS", True)]

        notification_records: List[Dict[str, Any]] = []
        contacts_notified_count = 0
        contacts_unavailable_count = 0
        contacts_failed_count = 0
        delivery_attempts = 0

        # Email Alert Dispatch Tracking (Requirement 6 & 7)
        sent_emails: Dict[str, Dict[str, Any]] = {}
        email_recipients: List[Dict[str, Any]] = []
        emails_queued_count = 0
        emails_sent_count = 0
        emails_failed_count = 0
        emails_unconfigured_count = 0

        emergency_email_payload = {
            "eventId": event_id,
            "patientName": patient_name,
            "patientPhone": patient_phone,
            "patientUid": patient_uid,
            "location": location,
            "notes": notes,
            "severity": severity,
            "timestamp": now_iso
        }

        # 4. Dispatch FCM Notifications & Email Alerts independently to each eligible family member
        sent_tokens = set()
        seen_contact_targets = set()

        for contact in target_contacts:
            contact_id = contact.get("id", "")
            contact_name = contact.get("fullName", "Family Member")
            contact_phone = contact.get("phone", "")
            contact_email = normalize_email(contact.get("email"))

            # Prevent duplicate contact processing
            phone_norm = contact_phone.replace(" ", "").replace("-", "")[-10:] if len(contact_phone) >= 10 else contact_phone
            c_key = contact.get("contactUserId") or contact_email or phone_norm or contact_id
            if c_key in seen_contact_targets:
                logger.warning(f"Skipping duplicate target contact {contact_name} ({c_key}) during SOS dispatch")
                continue
            seen_contact_targets.add(c_key)

            # ── CHANNEL B: EMAIL EMERGENCY ALERT ──────────────────────────────────────────
            email_status = "not_configured"
            email_error = None
            email_job_id = None

            if contact_email:
                if not is_valid_email(contact_email):
                    email_status = "failed"
                    email_error = "Invalid email format"
                    emails_failed_count += 1
                else:
                    # Requirement 7: Email Deduplication
                    # If two active contacts share the exact same email address, send only ONE email job,
                    # but preserve individual contact delivery records.
                    if contact_email in sent_emails:
                        cached_res = sent_emails[contact_email]
                        email_status = cached_res.get("status", "queued")
                        email_job_id = cached_res.get("mailJobId")
                        email_error = cached_res.get("error")
                    else:
                        email_res = await EmailService.send_emergency_email(
                            recipient_email=contact_email,
                            emergency_data=emergency_email_payload
                        )
                        sent_emails[contact_email] = email_res
                        email_status = email_res.get("status", "queued")
                        email_job_id = email_res.get("mailJobId")
                        email_error = email_res.get("error")

                        if email_status == "queued":
                            emails_queued_count += 1
                        elif email_status == "sent":
                            emails_sent_count += 1
                        elif email_status == "email_not_configured":
                            emails_unconfigured_count += 1
                        else:
                            emails_failed_count += 1

                email_recipients.append({
                    "contactId": contact_id,
                    "contactName": contact_name,
                    "email": contact_email,
                    "status": email_status,
                    "mailJobId": email_job_id,
                    "error": email_error,
                    "timestamp": datetime.now().isoformat()
                })

            # ── CHANNEL A: FCM PUSH NOTIFICATION ──────────────────────────────────────────
            # Resolve actual push device targets with diagnostic reporting
            resolution = await cls.resolve_contact_push_target(contact, patient_uid)
            resolved_tokens = resolution.get("tokens", [])

            # Filter tokens not already sent in this SOS event (Requirement 16: Deduplicate recipient FCM tokens)
            tokens_to_send = [tok for tok in resolved_tokens if tok not in sent_tokens]

            if tokens_to_send:
                contact_sent_any = False
                for tok in tokens_to_send:
                    sent_tokens.add(tok)
                    delivery_attempts += 1
                    fcm_res = FCMService.send_emergency_sos_notification(
                        device_token=tok,
                        event_id=event_id,
                        patient_name=patient_name,
                        patient_phone=patient_phone or "",
                        latitude=lat,
                        longitude=lng,
                        sender_user_id=patient_uid
                    )

                    token_display = tok[:6] + "..." + tok[-4:] if len(tok) > 12 else "***"
                    if fcm_res.get("success"):
                        contact_sent_any = True
                        notification_records.append({
                            "contactId": contact_id,
                            "contactName": contact_name,
                            "contactPhone": contact_phone,
                            "email": contact_email,
                            "emailStatus": email_status,
                            "deviceToken": token_display,
                            "status": "sent",
                            "fcmMessageId": fcm_res.get("messageId"),
                            "error": None,
                            "timestamp": datetime.now().isoformat()
                        })
                    else:
                        if fcm_res.get("is_stale"):
                            # Stale token handling - automatically mark inactive in Firestore
                            await cls.mark_device_token_inactive(tok, reason=fcm_res.get("error", "unregistered"))
                            contacts_unavailable_count += 1
                            notification_records.append({
                                "contactId": contact_id,
                                "contactName": contact_name,
                                "contactPhone": contact_phone,
                                "email": contact_email,
                                "emailStatus": email_status,
                                "deviceToken": token_display,
                                "status": "unavailable",
                                "fcmMessageId": None,
                                "error": "Push notification unavailable (device token expired or unregistered)",
                                "timestamp": datetime.now().isoformat()
                            })
                        else:
                            contacts_failed_count += 1
                            notification_records.append({
                                "contactId": contact_id,
                                "contactName": contact_name,
                                "contactPhone": contact_phone,
                                "email": contact_email,
                                "emailStatus": email_status,
                                "deviceToken": token_display,
                                "status": "failed",
                                "fcmMessageId": None,
                                "error": fcm_res.get("error") or "FCM delivery failed",
                                "timestamp": datetime.now().isoformat()
                            })

                if contact_sent_any:
                    contacts_notified_count += 1
            else:
                # Registered contact has no active push device registered
                contacts_unavailable_count += 1
                reason_msg = resolution.get("reason") or f"Push notification unavailable for {contact_name}."
                notification_records.append({
                    "contactId": contact_id,
                    "contactName": contact_name,
                    "contactPhone": contact_phone,
                    "email": contact_email,
                    "emailStatus": email_status,
                    "deviceToken": None,
                    "status": "unavailable",
                    "fcmMessageId": None,
                    "error": reason_msg,
                    "timestamp": datetime.now().isoformat()
                })

        # Structured Email Delivery Summary Object
        email_delivery = {
            "attempted": bool(email_recipients),
            "totalRecipients": len(email_recipients),
            "queued": emails_queued_count,
            "sent": emails_sent_count,
            "failed": emails_failed_count,
            "unconfigured": emails_unconfigured_count,
            "recipients": email_recipients
        }

        # Determine overall event status
        any_channel_succeeded = contacts_notified_count > 0 or (emails_queued_count + emails_sent_count) > 0
        if any_channel_succeeded:
            final_status = "Alert Sent"
            audit_trail.append({
                "status": "Alert Sent",
                "timestamp": datetime.now().isoformat(),
                "updatedBy": "System",
                "notes": f"Dispatched alerts: FCM push to {contacts_notified_count} contact(s), Email alerts to {emails_queued_count + emails_sent_count} contact(s)"
            })
        elif not target_contacts:
            final_status = "SOS Initiated (No Contacts)"
        else:
            final_status = "SOS Initiated (Push Unavailable)"

        event_data: Dict[str, Any] = {
            "id": event_id,
            "alertId": event_id,
            "patientUid": patient_uid,
            "patientName": patient_name or "GramCare Patient",
            "patientPhone": patient_phone or "",
            "senderUserId": patient_uid,
            "senderName": patient_name or "GramCare Patient",
            "senderPhone": patient_phone or "",
            "createdAt": now_iso,
            "updatedAt": now_iso,
            "latitude": lat,
            "longitude": lng,
            "locationAccuracy": acc,
            "locationAvailable": loc_avail,
            "location": location,
            "notes": notes,
            "severity": severity,
            "status": final_status,
            "auditTrail": audit_trail,
            "notifiedContacts": notification_records,
            "contactsNotifiedCount": contacts_notified_count,
            "contactsUnavailableCount": contacts_unavailable_count,
            "contactsFailedCount": contacts_failed_count,
            "deliveryAttempts": delivery_attempts,
            "emailDelivery": email_delivery,
            "emailsQueuedCount": emails_queued_count,
            "emailsSentCount": emails_sent_count,
            "emailsFailedCount": emails_failed_count,
            "acknowledgedBy": None,
            "resolvedBy": None
        }

        # 5. Persist to Firestore
        db = get_firestore_client()
        if db:
            try:
                db.collection("emergency_events").document(event_id).set(event_data)
                db.collection("users").document(patient_uid).collection("emergencyEvents").document(event_id).set(event_data)
                logger.info(f"Persisted emergency event {event_id} to Firestore (FCM={contacts_notified_count}, Email={emails_queued_count + emails_sent_count})")
            except Exception as e:
                logger.warning(f"Firestore create_sos_event failed: {e}. Storing in-memory.")
                logger.warning(f"Firestore create_sos_event failed: {e}. Storing in-memory.")

        _in_memory_events[event_id] = event_data
        return event_data

    @classmethod
    async def get_sos_event(cls, event_id: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves an emergency event by ID.
        """
        if not event_id:
            return None

        db = get_firestore_client()
        if db:
            try:
                doc = db.collection("emergency_events").document(event_id).get()
                if doc.exists:
                    return doc.to_dict()
            except Exception as e:
                logger.warning(f"Firestore get_sos_event error: {e}")

        return _in_memory_events.get(event_id)

    @classmethod
    async def get_patient_alerts(cls, patient_uid: str) -> List[Dict[str, Any]]:
        """
        Retrieves all emergency events for a patient.
        """
        if not patient_uid:
            return []

        db = get_firestore_client()
        if db:
            try:
                coll = db.collection("users").document(patient_uid).collection("emergencyEvents")
                docs = coll.stream()
                events = [d.to_dict() for d in docs]
                if events:
                    return sorted(events, key=lambda x: x.get("createdAt", ""), reverse=True)
            except Exception as e:
                logger.warning(f"Firestore get_patient_alerts error: {e}")

        user_events = [e for e in _in_memory_events.values() if e.get("patientUid") == patient_uid or e.get("senderUserId") == patient_uid]
        return sorted(user_events, key=lambda x: x.get("createdAt", ""), reverse=True)

    @classmethod
    async def get_active_patient_alerts(cls, patient_uid: str) -> List[Dict[str, Any]]:
        """
        Returns active unresolved emergency events for a patient.
        """
        all_alerts = await cls.get_patient_alerts(patient_uid)
        return [
            a for a in all_alerts
            if a.get("status") not in ["Resolved", "Cancelled"]
        ]

    @classmethod
    async def update_event_location(cls, event_id: str, location: Dict[str, Any]) -> bool:
        """
        Updates the GPS location of an ongoing emergency event.
        """
        event = await cls.get_sos_event(event_id)
        if not event:
            return False

        lat = location.get("latitude")
        lng = location.get("longitude")
        acc = location.get("accuracyMeters") or location.get("accuracy")

        event["location"] = location
        event["latitude"] = lat
        event["longitude"] = lng
        event["locationAccuracy"] = acc
        event["locationAvailable"] = bool(lat is not None and lng is not None)
        event["updatedAt"] = datetime.now().isoformat()

        db = get_firestore_client()
        if db:
            try:
                db.collection("emergency_events").document(event_id).update({
                    "location": location,
                    "latitude": lat,
                    "longitude": lng,
                    "locationAccuracy": acc,
                    "locationAvailable": event["locationAvailable"],
                    "updatedAt": event["updatedAt"]
                })
                patient_uid = event.get("patientUid") or event.get("senderUserId")
                if patient_uid:
                    db.collection("users").document(patient_uid).collection("emergencyEvents").document(event_id).update({
                        "location": location,
                        "latitude": lat,
                        "longitude": lng,
                        "locationAccuracy": acc,
                        "locationAvailable": event["locationAvailable"],
                        "updatedAt": event["updatedAt"]
                    })
            except Exception as e:
                logger.warning(f"Firestore update_event_location error: {e}")

        _in_memory_events[event_id] = event
        return True

    @classmethod
    async def mark_event_delivered(
        cls,
        event_id: str,
        contact_id: Optional[str] = None,
        source: str = "client"
    ) -> Optional[Dict[str, Any]]:
        """
        Records that an alert has actually been delivered to the recipient device.
        Transitions contact record status from 'sent' to 'delivered'.
        """
        event = await cls.get_sos_event(event_id)
        if not event:
            return None

        now_iso = datetime.now().isoformat()
        notified = event.get("notifiedContacts", [])
        changed = False

        for r in notified:
            if contact_id:
                if r.get("contactId") == contact_id:
                    r["status"] = "delivered"
                    r["deliveredAt"] = now_iso
                    changed = True
            else:
                if r.get("status") == "sent":
                    r["status"] = "delivered"
                    r["deliveredAt"] = now_iso
                    changed = True

        if event.get("status") in ["Alert Sent", "Notifications Submitted", "Alert Processing"]:
            event["status"] = "Delivered to Device"

        event["updatedAt"] = now_iso
        event.setdefault("auditTrail", []).append({
            "status": "Delivered to Device",
            "timestamp": now_iso,
            "updatedBy": f"Device Push Listener ({source})",
            "notes": "Emergency notification confirmed received on recipient device"
        })

        db = get_firestore_client()
        if db:
            try:
                db.collection("emergency_events").document(event_id).set(event, merge=True)
                p_uid = event.get("patientUid") or event.get("senderUserId")
                if p_uid:
                    db.collection("users").document(p_uid).collection("emergencyEvents").document(event_id).set(event, merge=True)
            except Exception as e:
                logger.warning(f"Firestore mark_event_delivered error: {e}")

        _in_memory_events[event_id] = event
        return event

    @classmethod
    async def mark_event_opened(
        cls,
        event_id: str,
        contact_id: Optional[str] = None,
        source: str = "client"
    ) -> Optional[Dict[str, Any]]:
        """
        Records that a recipient has clicked or opened the emergency alert screen.
        Transitions status to 'Notification Opened'.
        """
        event = await cls.get_sos_event(event_id)
        if not event:
            return None

        now_iso = datetime.now().isoformat()
        notified = event.get("notifiedContacts", [])

        for r in notified:
            if contact_id:
                if r.get("contactId") == contact_id:
                    r["status"] = "opened"
                    r["openedAt"] = now_iso
            else:
                if r.get("status") in ["sent", "delivered"]:
                    r["status"] = "opened"
                    r["openedAt"] = now_iso

        if event.get("status") in ["Alert Sent", "Notifications Submitted", "Delivered to Device"]:
            event["status"] = "Notification Opened"

        event["updatedAt"] = now_iso
        event.setdefault("auditTrail", []).append({
            "status": "Notification Opened",
            "timestamp": now_iso,
            "updatedBy": f"Family Member App ({source})",
            "notes": "Emergency alert details opened by family recipient"
        })

        db = get_firestore_client()
        if db:
            try:
                db.collection("emergency_events").document(event_id).set(event, merge=True)
                p_uid = event.get("patientUid") or event.get("senderUserId")
                if p_uid:
                    db.collection("users").document(p_uid).collection("emergencyEvents").document(event_id).set(event, merge=True)
            except Exception as e:
                logger.warning(f"Firestore mark_event_opened error: {e}")

        _in_memory_events[event_id] = event
        return event

    @classmethod
    async def acknowledge_sos_event(
        cls,
        event_id: str,
        responder_name: str,
        responder_phone: Optional[str] = None,
        responder_relation: Optional[str] = None,
        message: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Marks an emergency event as acknowledged by a family member.
        """
        event = await cls.get_sos_event(event_id)
        if not event:
            return None

        now_iso = datetime.now().isoformat()
        ack_record = {
            "responderName": responder_name,
            "responderPhone": responder_phone,
            "responderRelation": responder_relation,
            "message": message,
            "acknowledgedAt": now_iso
        }

        event["status"] = "Family Acknowledged"
        event["acknowledgedBy"] = ack_record
        event["updatedAt"] = now_iso

        for r in event.get("notifiedContacts", []):
            if r.get("status") in ["sent", "delivered", "opened"]:
                r["status"] = "acknowledged"
                r["acknowledgedAt"] = now_iso

        event.setdefault("auditTrail", []).append({
            "status": "Family Acknowledged",
            "timestamp": now_iso,
            "updatedBy": responder_name,
            "notes": message or f"Acknowledged by {responder_name}"
        })

        db = get_firestore_client()
        if db:
            try:
                db.collection("emergency_events").document(event_id).set(event, merge=True)
                patient_uid = event.get("patientUid") or event.get("senderUserId")
                if patient_uid:
                    db.collection("users").document(patient_uid).collection("emergencyEvents").document(event_id).set(event, merge=True)
            except Exception as e:
                logger.warning(f"Firestore acknowledge_sos_event error: {e}")

        _in_memory_events[event_id] = event
        return event

    @classmethod
    async def resolve_sos_event(
        cls,
        event_id: str,
        resolved_by: str,
        resolution_notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Resolves an emergency alert event.
        """
        event = await cls.get_sos_event(event_id)
        if not event:
            return None

        now_iso = datetime.now().isoformat()
        res_record = {
            "resolvedBy": resolved_by,
            "resolutionNotes": resolution_notes,
            "resolvedAt": now_iso
        }

        event["status"] = "Resolved"
        event["resolvedBy"] = res_record
        event["updatedAt"] = now_iso
        event.setdefault("auditTrail", []).append({
            "status": "Resolved",
            "timestamp": now_iso,
            "updatedBy": resolved_by,
            "notes": resolution_notes or "Emergency resolved successfully"
        })

        db = get_firestore_client()
        if db:
            try:
                db.collection("emergency_events").document(event_id).set(event, merge=True)
                patient_uid = event.get("patientUid") or event.get("senderUserId")
                if patient_uid:
                    db.collection("users").document(patient_uid).collection("emergencyEvents").document(event_id).set(event, merge=True)
            except Exception as e:
                logger.warning(f"Firestore resolve_sos_event error: {e}")

        _in_memory_events[event_id] = event
        return event

    @classmethod
    async def update_sos_status(
        cls,
        event_id: str,
        new_status: str,
        updated_by: str,
        notes: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Transitions emergency event status (e.g. 'Help Is on the Way', 'Cancelled').
        """
        event = await cls.get_sos_event(event_id)
        if not event:
            return None

        now_iso = datetime.now().isoformat()
        event["status"] = new_status
        event["updatedAt"] = now_iso
        event.setdefault("auditTrail", []).append({
            "status": new_status,
            "timestamp": now_iso,
            "updatedBy": updated_by,
            "notes": notes
        })

        db = get_firestore_client()
        if db:
            try:
                db.collection("emergency_events").document(event_id).set(event, merge=True)
                patient_uid = event.get("patientUid") or event.get("senderUserId")
                if patient_uid:
                    db.collection("users").document(patient_uid).collection("emergencyEvents").document(event_id).set(event, merge=True)
            except Exception as e:
                logger.warning(f"Firestore update_sos_status error: {e}")

        _in_memory_events[event_id] = event
        return event

    # ─────────────────────────────────────────────────────────────
    # Emergency Contact Management
    # ─────────────────────────────────────────────────────────────

    @classmethod
    async def resolve_contact_push_target(cls, contact: Dict[str, Any], patient_uid: str) -> Dict[str, Any]:
        """
        Thoroughly resolves push notification targets for an emergency contact and reports
        diagnostic details required for emergency audit.
        CRITICAL: Never exposes raw FCM tokens in logs or responses.
        CRITICAL: Never falls back to patient_uid (the sender) to prevent sender-echo alerts.
        """
        contact_id = contact.get("id", "unknown")
        contact_name = contact.get("fullName", "Family Member")
        contact_phone = (contact.get("phone") or "").strip()
        contact_user_id = contact.get("contactUserId") or contact.get("userId")
        notify_on_sos = bool(contact.get("notifyOnSOS", True))

        recipient_user = None
        recipient_uid = None
        recipient_name = None
        recipient_found = False
        is_sender_echo = False
        tokens: List[str] = []

        # 1. Direct device tokens explicitly listed on contact record
        for tok in contact.get("deviceTokens", []):
            if tok and isinstance(tok, str) and tok not in tokens:
                tokens.append(tok)

        # 2. Linked contactUserId
        if contact_user_id:
            if contact_user_id == patient_uid:
                is_sender_echo = True
            else:
                from services.firestore_user_service import get_user_by_uid
                user = await get_user_by_uid(contact_user_id)
                if user:
                    recipient_user = user
                    recipient_uid = contact_user_id
                    recipient_name = user.get("fullName") or user.get("displayName") or contact_name
                    recipient_found = True
                    u_tokens = await cls.get_patient_device_tokens(contact_user_id)
                    for t in u_tokens:
                        fcm_tok = t.get("fcmToken")
                        if fcm_tok and fcm_tok not in tokens:
                            tokens.append(fcm_tok)

        # 3. Lookup by email if not resolved
        email = (contact.get("email") or "").strip().lower()
        if not tokens and not recipient_found and email:
            from services.firestore_user_service import get_user_by_email
            user = await get_user_by_email(email)
            if user:
                found_uid = user.get("uid") or user.get("id")
                if found_uid == patient_uid:
                    is_sender_echo = True
                else:
                    recipient_user = user
                    recipient_uid = found_uid
                    recipient_name = user.get("fullName") or user.get("displayName") or contact_name
                    recipient_found = True
                    u_tokens = await cls.get_patient_device_tokens(found_uid)
                    for t in u_tokens:
                        fcm_tok = t.get("fcmToken")
                        if fcm_tok and fcm_tok not in tokens:
                            tokens.append(fcm_tok)

        # 4. Lookup by phone if not resolved
        cleaned_phone = contact_phone.replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
        phone_10 = cleaned_phone[-10:] if len(cleaned_phone) >= 10 else cleaned_phone
        if not tokens and not recipient_found and phone_10:
            db = get_firestore_client()
            if db:
                try:
                    candidates = []
                    for candidate_phone in set([cleaned_phone, phone_10, f"+91{phone_10}", f"91{phone_10}"]):
                        q = db.collection("users").where("phone", "==", candidate_phone).limit(1).stream()
                        for doc in q:
                            candidates.append((doc.id, doc.to_dict()))
                            break
                        if candidates:
                            break

                    if candidates:
                        found_uid, u_data = candidates[0]
                        if found_uid == patient_uid:
                            is_sender_echo = True
                        else:
                            recipient_user = u_data
                            recipient_uid = found_uid
                            recipient_name = u_data.get("fullName") or u_data.get("displayName") or contact_name
                            recipient_found = True
                            u_tokens = await cls.get_patient_device_tokens(found_uid)
                            for t in u_tokens:
                                fcm_tok = t.get("fcmToken")
                                if fcm_tok and fcm_tok not in tokens:
                                    tokens.append(fcm_tok)
                except Exception as e:
                    logger.debug(f"User search by phone note: {e}")

        # Diagnostic Status Evaluation
        active_tokens = [t for t in tokens if t and isinstance(t, str)]
        device_count = len(active_tokens)

        if not notify_on_sos:
            resolution_status = "NOTIFY_DISABLED"
            reason = "SOS notifications disabled for this contact in user settings."
            eligibility = False
        elif is_sender_echo and not tokens:
            resolution_status = "SENDER_ECHO_PREVENTED"
            reason = "Contact is mapped to sender's own phone/account. Self-notifications blocked to prevent alert loopback."
            eligibility = False
        elif not recipient_found and not tokens:
            resolution_status = "USER_NOT_REGISTERED"
            reason = f"No GramCare account found for {contact_name} ({contact_phone}). Family member must open GramCare on mobile and enable alerts."
            eligibility = False
        elif device_count == 0:
            resolution_status = "NO_ACTIVE_TOKENS"
            reason = f"GramCare account exists for {contact_name}, but no active mobile push tokens registered."
            eligibility = False
        else:
            resolution_status = "READY"
            reason = f"Push notifications ready ({device_count} registered active device token(s))."
            eligibility = True

        # Safe diagnostic log without exposing raw tokens
        logger.info(
            f"[Emergency Contact Resolution] contactId={contact_id} | name='{contact_name}' | "
            f"hasContactUserId={bool(contact_user_id)} | recipientFound={recipient_found} | "
            f"recipientUid={recipient_uid} | devices={device_count} | eligible={eligibility} | "
            f"status={resolution_status} | reason={reason}"
        )

        return {
            "contactId": contact_id,
            "contactName": contact_name,
            "contactPhone": contact_phone,
            "hasContactUserId": bool(contact_user_id),
            "contactUserId": recipient_uid or contact_user_id,
            "recipientUserFound": recipient_found,
            "recipientUid": recipient_uid,
            "recipientName": recipient_name,
            "deviceCount": device_count,
            "activeTokenCount": len(active_tokens),
            "tokens": active_tokens,
            "notificationEligibility": eligibility,
            "resolutionStatus": resolution_status,
            "reason": reason
        }

    @classmethod
    async def find_device_tokens_for_contact(cls, contact: Dict[str, Any], patient_uid: str) -> List[str]:
        """
        Finds active device push tokens belonging to a specific emergency contact.
        Delegates to resolve_contact_push_target for audit consistency.
        """
        resolution = await cls.resolve_contact_push_target(contact, patient_uid)
        return resolution.get("tokens", [])

    @classmethod
    async def list_emergency_contacts(cls, uid: str) -> List[Dict[str, Any]]:
        """
        Retrieves emergency contacts for a patient, enriching each contact with:
        - deviceTokens
        - hasPushDevice
        - notificationStatus
        - resolutionStatus
        - statusReason
        - isDuplicate
        - linkedUserName
        - isActive
        """
        if not uid:
            return []

        contacts: List[Dict[str, Any]] = []

        db = get_firestore_client()
        if db:
            try:
                coll = db.collection("users").document(uid).collection("emergencyContacts")
                docs = coll.stream()
                for doc in docs:
                    c = doc.to_dict()
                    if c:
                        contacts.append(c)
            except Exception as e:
                logger.warning(f"Firestore list_emergency_contacts error: {e}")

        # Check in-memory store
        user_contacts = _in_memory_contacts.get(uid, {})
        for cid, c in user_contacts.items():
            if not any(item.get("id") == cid for item in contacts):
                contacts.append(c)

        # Track phone duplicates for duplicate warning
        seen_phones = set()
        seen_user_ids = set()

        # Enrich each contact with live token detection and audit resolution
        enriched_contacts: List[Dict[str, Any]] = []
        for c in contacts:
            c_copy = dict(c)
            resolution = await cls.resolve_contact_push_target(c_copy, uid)
            tokens = resolution.get("tokens", [])
            has_push = len(tokens) > 0

            # Check duplicate
            phone_raw = (c_copy.get("phone") or "").replace(" ", "").replace("-", "")
            phone_10 = phone_raw[-10:] if len(phone_raw) >= 10 else phone_raw
            uid_key = resolution.get("contactUserId")

            is_dup = False
            if phone_10 and phone_10 in seen_phones:
                is_dup = True
            elif uid_key and uid_key in seen_user_ids:
                is_dup = True

            if phone_10:
                seen_phones.add(phone_10)
            if uid_key:
                seen_user_ids.add(uid_key)

            c_copy["deviceTokens"] = tokens
            c_copy["hasPushDevice"] = has_push
            c_copy["notificationStatus"] = "Push Alerts Ready" if has_push else "Push notifications unavailable"
            clean_email = normalize_email(c_copy.get("email"))
            c_copy["email"] = clean_email
            c_copy["hasEmail"] = bool(clean_email)
            c_copy["emailStatus"] = "Email Alerts Ready" if clean_email else "Email not configured"
            c_copy["resolutionStatus"] = resolution.get("resolutionStatus")
            c_copy["statusReason"] = resolution.get("reason")
            c_copy["isDuplicate"] = is_dup
            c_copy["linkedUserName"] = resolution.get("recipientName")
            if resolution.get("recipientUid") and not c_copy.get("contactUserId"):
                c_copy["contactUserId"] = resolution.get("recipientUid")
            c_copy["isActive"] = bool(c_copy.get("notifyOnSOS", True))
            enriched_contacts.append(c_copy)

        return sorted(enriched_contacts, key=lambda x: x.get("createdAt", ""), reverse=True)

    @classmethod
    async def create_emergency_contact(cls, uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Creates a new emergency contact under users/{uid}/emergencyContacts.
        Auto-links contactUserId if a matching GramCare user exists.
        Supports phone, email, or both.
        """
        contact_id = data.get("id") or _generate_contact_id()
        now_iso = datetime.now().isoformat()
        clean_email = normalize_email(data.get("email"))
        clean_phone = (data.get("phone") or "").strip()

        contact: Dict[str, Any] = {
            "id": contact_id,
            "patientUid": uid,
            "fullName": data.get("fullName", "").strip(),
            "relation": data.get("relation", "Relative").strip(),
            "phone": clean_phone,
            "email": clean_email,
            "hasEmail": bool(clean_email),
            "emailStatus": "Email Alerts Ready" if clean_email else "Email not configured",
            "contactUserId": data.get("contactUserId"),
            "notifyOnSOS": bool(data.get("notifyOnSOS", True)),
            "isEmergencyContact": bool(data.get("isEmergencyContact", True)),
            "isVerified": False,
            "deviceTokens": data.get("deviceTokens", []),
            "createdAt": data.get("createdAt") or now_iso,
            "updatedAt": now_iso
        }

        # Auto-link contactUserId if not provided but email/phone is registered
        resolution = await cls.resolve_contact_push_target(contact, uid)
        if resolution.get("recipientUid") and not contact.get("contactUserId"):
            contact["contactUserId"] = resolution.get("recipientUid")
            logger.info(f"Auto-linked contact '{contact['fullName']}' to GramCare user {resolution['recipientUid']}")

        tokens = resolution.get("tokens", [])
        contact["deviceTokens"] = tokens
        contact["hasPushDevice"] = len(tokens) > 0
        contact["notificationStatus"] = "Push Alerts Ready" if len(tokens) > 0 else "Push notifications unavailable"
        contact["resolutionStatus"] = resolution.get("resolutionStatus")
        contact["statusReason"] = resolution.get("reason")
        contact["linkedUserName"] = resolution.get("recipientName")
        contact["isActive"] = contact["notifyOnSOS"]

        db = get_firestore_client()
        if db:
            try:
                db.collection("users").document(uid).collection("emergencyContacts").document(contact_id).set(contact, merge=True)
                logger.info(f"Saved emergency contact users/{uid}/emergencyContacts/{contact_id}")
            except Exception as e:
                logger.warning(f"Firestore create_emergency_contact error: {e}")

        if uid not in _in_memory_contacts:
            _in_memory_contacts[uid] = {}
        _in_memory_contacts[uid][contact_id] = contact

        return contact

    @classmethod
    async def update_emergency_contact(cls, uid: str, contact_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Updates an emergency contact.
        """
        contacts = await cls.list_emergency_contacts(uid)
        existing = next((c for c in contacts if c.get("id") == contact_id), None)
        if not existing:
            return None

        now_iso = datetime.now().isoformat()
        clean_updates = dict(updates)
        if "email" in clean_updates:
            clean_updates["email"] = normalize_email(clean_updates.get("email"))
        if "phone" in clean_updates:
            clean_updates["phone"] = (clean_updates.get("phone") or "").strip()

        updated = {
            **existing,
            **{k: v for k, v in clean_updates.items() if v is not None},
            "id": contact_id,
            "patientUid": uid,
            "updatedAt": now_iso
        }
        updated["hasEmail"] = bool(updated.get("email"))
        updated["emailStatus"] = "Email Alerts Ready" if updated.get("email") else "Email not configured"

        # Resolve tokens and auto-link user if needed
        resolution = await cls.resolve_contact_push_target(updated, uid)
        if resolution.get("recipientUid") and not updated.get("contactUserId"):
            updated["contactUserId"] = resolution.get("recipientUid")

        tokens = resolution.get("tokens", [])
        updated["deviceTokens"] = tokens
        updated["hasPushDevice"] = len(tokens) > 0
        updated["notificationStatus"] = "Push Alerts Ready" if len(tokens) > 0 else "Push notifications unavailable"
        updated["resolutionStatus"] = resolution.get("resolutionStatus")
        updated["statusReason"] = resolution.get("reason")
        updated["linkedUserName"] = resolution.get("recipientName")
        updated["isActive"] = bool(updated.get("notifyOnSOS", True))

        db = get_firestore_client()
        if db:
            try:
                db.collection("users").document(uid).collection("emergencyContacts").document(contact_id).set(updated, merge=True)
            except Exception as e:
                logger.warning(f"Firestore update_emergency_contact error: {e}")
                logger.warning(f"Firestore update_emergency_contact error: {e}")

        if uid not in _in_memory_contacts:
            _in_memory_contacts[uid] = {}
        _in_memory_contacts[uid][contact_id] = updated

        return updated

    @classmethod
    async def delete_emergency_contact(cls, uid: str, contact_id: str) -> bool:
        """
        Deletes an emergency contact.
        """
        db = get_firestore_client()
        if db:
            try:
                db.collection("users").document(uid).collection("emergencyContacts").document(contact_id).delete()
            except Exception as e:
                logger.warning(f"Firestore delete_emergency_contact error: {e}")

        if uid in _in_memory_contacts and contact_id in _in_memory_contacts[uid]:
            del _in_memory_contacts[uid][contact_id]

        return True

    @classmethod
    async def clean_duplicate_emergency_contacts(cls, uid: str) -> Dict[str, Any]:
        """
        Finds and safely removes redundant duplicate emergency contacts for a patient.
        Preserves the primary contact record.
        """
        contacts = await cls.list_emergency_contacts(uid)
        seen_phones: Dict[str, str] = {}
        duplicates_removed = []

        for c in contacts:
            raw_phone = (c.get("phone") or "").strip().replace(" ", "").replace("-", "")
            norm_phone = raw_phone[-10:] if len(raw_phone) >= 10 else raw_phone
            cid = c.get("id")
            if not norm_phone or not cid:
                continue

            if norm_phone in seen_phones:
                # Remove redundant duplicate
                await cls.delete_emergency_contact(uid, cid)
                duplicates_removed.append({
                    "id": cid,
                    "fullName": c.get("fullName"),
                    "phone": c.get("phone"),
                    "keptId": seen_phones[norm_phone]
                })
                logger.info(f"Safely removed duplicate emergency contact {cid} ('{c.get('fullName')}')")
            else:
                seen_phones[norm_phone] = cid

        return {
            "success": True,
            "removedCount": len(duplicates_removed),
            "removed": duplicates_removed
        }

    @classmethod
    async def lookup_gramcare_user(cls, query: str, current_user_uid: str) -> Dict[str, Any]:
        """
        Looks up a registered GramCare user by email, phone, or UID for emergency contact linking.
        Never exposes sensitive records or private health data.
        """
        clean_query = (query or "").strip().lower()
        if not clean_query:
            return {"found": False, "message": "Search query is required"}

        db = get_firestore_client()
        if not db:
            return {"found": False, "message": "Database unavailable"}

        # 1. Direct UID match
        try:
            doc = db.collection("users").document(clean_query).get()
            if doc.exists:
                if doc.id == current_user_uid:
                    return {"found": False, "isSelf": True, "message": "Cannot link your own account as an emergency contact"}
                u_data = doc.to_dict() or {}
                tokens = await cls.get_patient_device_tokens(doc.id)
                return {
                    "found": True,
                    "userId": doc.id,
                    "fullName": u_data.get("fullName") or u_data.get("displayName") or "GramCare User",
                    "hasPushDevice": len(tokens) > 0,
                    "activeDevices": len(tokens)
                }
        except Exception:
            pass

        # 2. Email match
        if "@" in clean_query:
            try:
                from services.firestore_user_service import get_user_by_email
                user = await get_user_by_email(clean_query)
                if user:
                    uid = user.get("uid") or user.get("id")
                    if uid == current_user_uid:
                        return {"found": False, "isSelf": True, "message": "Cannot link your own account as an emergency contact"}
                    tokens = await cls.get_patient_device_tokens(uid)
                    return {
                        "found": True,
                        "userId": uid,
                        "fullName": user.get("fullName") or user.get("displayName") or "GramCare User",
                        "hasPushDevice": len(tokens) > 0,
                        "activeDevices": len(tokens)
                    }
            except Exception as e:
                logger.debug(f"Email lookup note: {e}")

        # 3. Phone match
        phone_clean = clean_query.replace(" ", "").replace("-", "")
        phone_10 = phone_clean[-10:] if len(phone_clean) >= 10 else phone_clean
        if phone_10:
            try:
                for cand in set([phone_clean, phone_10, f"+91{phone_10}", f"91{phone_10}"]):
                    q = db.collection("users").where("phone", "==", cand).limit(1).stream()
                    for doc in q:
                        if doc.id == current_user_uid:
                            return {"found": False, "isSelf": True, "message": "Cannot link your own account as an emergency contact"}
                        u_data = doc.to_dict() or {}
                        tokens = await cls.get_patient_device_tokens(doc.id)
                        return {
                            "found": True,
                            "userId": doc.id,
                            "fullName": u_data.get("fullName") or u_data.get("displayName") or "GramCare User",
                            "hasPushDevice": len(tokens) > 0,
                            "activeDevices": len(tokens)
                        }
            except Exception as e:
                logger.debug(f"Phone lookup note: {e}")

        return {"found": False, "message": "No registered GramCare user found with this email or phone number"}

    @classmethod
    async def mark_device_token_inactive(cls, token: str, reason: str = "unregistered"):
        """
        Marks an FCM device token as inactive in Firestore when reported invalid/expired by FCM.
        """
        token_hash = _hash_token(token)
        db = get_firestore_client()
        if db:
            try:
                # Query across users' deviceTokens subcollections
                q = db.collection_group("deviceTokens").where("tokenHash", "==", token_hash).limit(5).stream()
                for doc in q:
                    doc.reference.update({
                        "active": False,
                        "deactivatedAt": datetime.now().isoformat(),
                        "deactivationReason": reason
                    })
                    logger.info(f"Marked token {token_hash} inactive under {doc.reference.path}")
            except Exception as e:
                logger.warning(f"Error marking token inactive: {e}")

        # Update in-memory cache
        for uid, tdict in _in_memory_tokens.items():
            if token_hash in tdict:
                tdict[token_hash]["active"] = False

    # ─────────────────────────────────────────────────────────────
    # Push Device Token Registration & Cleanup
    # ─────────────────────────────────────────────────────────────

    @classmethod
    async def register_device_token(
        cls,
        uid: str,
        fcm_token: str,
        device_type: str = "web",
        device_name: str = "Browser",
        contact_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Registers an FCM push notification token under users/{uid}/deviceTokens.
        If contact_id is provided, also adds token to that contact's record.
        """
        now_iso = datetime.now().isoformat()
        token_hash = _hash_token(fcm_token)

        token_record = {
            "tokenHash": token_hash,
            "fcmToken": fcm_token,
            "userId": uid,
            "deviceType": device_type,
            "deviceName": device_name,
            "contactId": contact_id,
            "registeredAt": now_iso,
            "lastUsedAt": now_iso,
            "active": True
        }

        db = get_firestore_client()
        if db:
            try:
                db.collection("users").document(uid).collection("deviceTokens").document(token_hash).set(token_record, merge=True)
                logger.info(f"Registered FCM device token {token_hash} for user {uid}")
            except Exception as e:
                logger.warning(f"Firestore register_device_token error: {e}")

        if uid not in _in_memory_tokens:
            _in_memory_tokens[uid] = {}
        _in_memory_tokens[uid][token_hash] = token_record

        # If associated with a contact, update contact's deviceTokens array
        if contact_id:
            await cls.add_token_to_contact(uid, contact_id, fcm_token)

        return token_record

    @classmethod
    async def delete_device_token(cls, uid: str, token_or_hash: str) -> bool:
        """
        Removes an invalidated or revoked device token.
        """
        token_hash = token_or_hash if len(token_or_hash) == 24 and not token_or_hash.startswith("f") else _hash_token(token_or_hash)

        db = get_firestore_client()
        if db:
            try:
                db.collection("users").document(uid).collection("deviceTokens").document(token_hash).delete()
                logger.info(f"Removed FCM token {token_hash} for user {uid}")
            except Exception as e:
                logger.warning(f"Firestore delete_device_token error: {e}")

        if uid in _in_memory_tokens and token_hash in _in_memory_tokens[uid]:
            del _in_memory_tokens[uid][token_hash]

        return True

    @classmethod
    async def get_patient_device_tokens(cls, uid: str) -> List[Dict[str, Any]]:
        """
        Retrieves all active device tokens for a user/family account.
        """
        if not uid:
            return []

        tokens: List[Dict[str, Any]] = []
        db = get_firestore_client()
        if db:
            try:
                coll = db.collection("users").document(uid).collection("deviceTokens")
                for doc in coll.stream():
                    t = doc.to_dict()
                    if t and t.get("active", True):
                        tokens.append(t)
            except Exception as e:
                logger.warning(f"Firestore get_patient_device_tokens error: {e}")

        user_mem_tokens = _in_memory_tokens.get(uid, {})
        for th, t in user_mem_tokens.items():
            if not any(item.get("tokenHash") == th for item in tokens):
                tokens.append(t)

        return tokens

    @classmethod
    async def add_token_to_contact(cls, uid: str, contact_id: str, fcm_token: str):
        """
        Adds a device token to a specific emergency contact.
        """
        contacts = await cls.list_emergency_contacts(uid)
        target = next((c for c in contacts if c.get("id") == contact_id), None)
        if target:
            tokens = target.get("deviceTokens", [])
            if fcm_token not in tokens:
                tokens.append(fcm_token)
                await cls.update_emergency_contact(uid, contact_id, {"deviceTokens": tokens})
