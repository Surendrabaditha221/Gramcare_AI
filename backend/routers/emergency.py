"""
Emergency SOS & Push Notifications Router for GramCare AI
Provides complete endpoints for:
1. Triggering Emergency SOS with GPS acquisition
2. Dispatching high-priority FCM push notifications to family members
3. Viewing, acknowledging, and resolving emergency alerts
4. Emergency contacts CRUD
5. Registering client FCM device push tokens
"""
from fastapi import APIRouter, HTTPException, Depends, Header, status
from typing import List, Optional, Dict, Any
from schemas.emergency import (
    EmergencySOSCreate,
    EmergencyEventResponse,
    EmergencyAcknowledgeRequest,
    EmergencyResolveRequest,
    EmergencyStatusUpdateRequest,
    EmergencyEventDeliveryUpdate,
    EmergencyContactCreate,
    EmergencyContactUpdate,
    EmergencyContactResponse,
    DeviceTokenRegisterRequest
)
from services.firestore_emergency_service import FirestoreEmergencyService
from services.fcm_service import FCMService
from routers.auth import get_current_user_from_token

router = APIRouter(prefix="", tags=["Emergency SOS & Family Notifications"])


# ─────────────────────────────────────────────────────────────
# 1. Emergency SOS Trigger & Management
# ─────────────────────────────────────────────────────────────

@router.post(
    "/emergency/sos",
    response_model=EmergencyEventResponse,
    summary="Trigger Emergency SOS Alert with GPS Location"
)
async def trigger_emergency_sos(
    req: EmergencySOSCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Submits an authenticated Emergency SOS request.
    Creates an emergency event, debounces duplicates within 45s, and sends
    high-priority FCM notifications to registered family contacts.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=400, detail="Authenticated user ID is required")

    patient_name = current_user.get("fullName") or current_user.get("displayName") or "GramCare Patient"
    patient_phone = current_user.get("phone") or current_user.get("phoneNumber") or ""

    location_dict = req.location.model_dump() if req.location else None

    event = await FirestoreEmergencyService.create_sos_event(
        patient_uid=uid,
        patient_name=patient_name,
        patient_phone=patient_phone,
        location=location_dict,
        notes=req.notes,
        severity=req.severity or "CRITICAL",
        target_contact_id=req.targetContactId
    )

    return EmergencyEventResponse(**event)


@router.get(
    "/emergency/my-alerts",
    response_model=List[EmergencyEventResponse],
    summary="List All Emergency Events for Authenticated Patient"
)
async def get_my_alerts(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Retrieves history of emergency alerts triggered by the authenticated user.
    """
    uid = current_user.get("uid") or current_user.get("id")
    alerts = await FirestoreEmergencyService.get_patient_alerts(uid)
    return [EmergencyEventResponse(**a) for a in alerts]


# ─────────────────────────────────────────────────────────────
# 2. Emergency Contacts Management (Static routes before {id} wildcard)
# ─────────────────────────────────────────────────────────────

@router.get(
    "/emergency/contacts",
    response_model=List[EmergencyContactResponse],
    summary="List Registered Emergency Contacts for Authenticated Patient"
)
async def get_emergency_contacts(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Retrieves all emergency contacts associated with the authenticated patient.
    """
    uid = current_user.get("uid") or current_user.get("id")
    contacts = await FirestoreEmergencyService.list_emergency_contacts(uid)
    return [EmergencyContactResponse(**c) for c in contacts]


@router.post(
    "/emergency/contacts",
    response_model=EmergencyContactResponse,
    summary="Add New Emergency Contact"
)
async def create_emergency_contact(
    contact: EmergencyContactCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Adds a new emergency contact under the patient's profile.
    """
    uid = current_user.get("uid") or current_user.get("id")
    created = await FirestoreEmergencyService.create_emergency_contact(uid, contact.model_dump())
    return EmergencyContactResponse(**created)


@router.put(
    "/emergency/contacts/{id}",
    response_model=EmergencyContactResponse,
    summary="Update Emergency Contact Details or Notification Settings"
)
async def update_emergency_contact(
    id: str,
    updates: EmergencyContactUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Updates an emergency contact's details or toggles notification participation.
    """
    uid = current_user.get("uid") or current_user.get("id")
    updated = await FirestoreEmergencyService.update_emergency_contact(
        uid, id, updates.model_dump(exclude_unset=True)
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Emergency contact not found")

    return EmergencyContactResponse(**updated)


@router.delete(
    "/emergency/contacts/{id}",
    summary="Delete Emergency Contact"
)
async def delete_emergency_contact(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Removes an emergency contact from the patient's account.
    """
    uid = current_user.get("uid") or current_user.get("id")
    success = await FirestoreEmergencyService.delete_emergency_contact(uid, id)
    if not success:
        raise HTTPException(status_code=404, detail="Emergency contact not found")

    return {"success": True, "message": "Emergency contact deleted successfully"}


@router.get(
    "/emergency/lookup-user",
    summary="Lookup Registered GramCare User for Emergency Contact Linking"
)
async def lookup_gramcare_user(
    query: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Looks up a registered user by email, phone, or User ID to link as an emergency contact.
    """
    uid = current_user.get("uid") or current_user.get("id")
    result = await FirestoreEmergencyService.lookup_gramcare_user(query, uid)
    return result


@router.post(
    "/emergency/contacts/clean-duplicates",
    summary="Safely Clean Duplicate Emergency Contacts"
)
async def clean_duplicate_contacts(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Finds and safely deletes duplicate emergency contacts sharing the same phone number.
    """
    uid = current_user.get("uid") or current_user.get("id")
    result = await FirestoreEmergencyService.clean_duplicate_emergency_contacts(uid)
    return result


# ─────────────────────────────────────────────────────────────
# 1. Emergency Alert Detail & Status Workflow ({id} wildcards)
# ─────────────────────────────────────────────────────────────

@router.get(
    "/emergency/{id}",
    response_model=EmergencyEventResponse,
    summary="Get Emergency Alert Details by ID"
)
async def get_emergency_alert(
    id: str,
    authorization: Optional[str] = Header(None)
):
    """
    Retrieves emergency event details by ID.
    Accessible to authorized family members opening the push notification link.
    """
    event = await FirestoreEmergencyService.get_sos_event(id)
    if not event:
        raise HTTPException(status_code=404, detail="Emergency event not found or has expired")

    return EmergencyEventResponse(**event)


@router.post(
    "/emergency/{id}/acknowledge",
    response_model=EmergencyEventResponse,
    summary="Family Member Acknowledges Emergency Alert"
)
async def acknowledge_emergency_alert(
    id: str,
    req: EmergencyAcknowledgeRequest
):
    """
    Records that a family member has seen and acknowledged the emergency alert.
    Transitions status to 'Family Acknowledged'.
    """
    updated = await FirestoreEmergencyService.acknowledge_sos_event(
        event_id=id,
        responder_name=req.responderName,
        responder_phone=req.responderPhone,
        responder_relation=req.responderRelation,
        message=req.message
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Emergency event not found")

    return EmergencyEventResponse(**updated)


@router.post(
    "/emergency/{id}/delivered",
    response_model=EmergencyEventResponse,
    summary="Record Notification Delivery to Device"
)
async def mark_emergency_delivered(
    id: str,
    req: Optional[EmergencyEventDeliveryUpdate] = None
):
    """
    Called by recipient device service worker or foreground push listener
    when the FCM emergency alert payload is physically received.
    Transitions status to 'Delivered to Device'.
    """
    contact_id = req.contactId if req else None
    source = req.source if req and req.source else "client"
    updated = await FirestoreEmergencyService.mark_event_delivered(
        event_id=id,
        contact_id=contact_id,
        source=source
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Emergency event not found")

    return EmergencyEventResponse(**updated)


@router.post(
    "/emergency/{id}/opened",
    response_model=EmergencyEventResponse,
    summary="Record Recipient Opened Emergency Alert"
)
async def mark_emergency_opened(
    id: str,
    req: Optional[EmergencyEventDeliveryUpdate] = None
):
    """
    Called when a recipient clicks or opens the emergency alert screen.
    Transitions status to 'Notification Opened'.
    """
    contact_id = req.contactId if req else None
    source = req.source if req and req.source else "client"
    updated = await FirestoreEmergencyService.mark_event_opened(
        event_id=id,
        contact_id=contact_id,
        source=source
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Emergency event not found")

    return EmergencyEventResponse(**updated)


@router.post(
    "/emergency/{id}/status",
    response_model=EmergencyEventResponse,
    summary="Update Emergency Alert Status (e.g. Help Is on the Way)"
)
async def update_emergency_status(
    id: str,
    req: EmergencyStatusUpdateRequest
):
    """
    Transitions emergency alert status through defined workflow states:
    'Help Is on the Way', 'Cancelled', etc.
    """
    valid_statuses = [
        "SOS Initiated",
        "Alert Processing",
        "Notifications Submitted",
        "Family Acknowledged",
        "Help Is on the Way",
        "Resolved",
        "Cancelled"
    ]
    if req.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{req.status}'. Must be one of: {', '.join(valid_statuses)}"
        )

    updated = await FirestoreEmergencyService.update_sos_status(
        event_id=id,
        new_status=req.status,
        updated_by="Authorized Family / User",
        notes=req.notes
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Emergency event not found")

    return EmergencyEventResponse(**updated)


@router.post(
    "/emergency/{id}/resolve",
    response_model=EmergencyEventResponse,
    summary="Resolve Emergency Alert"
)
async def resolve_emergency_alert(
    id: str,
    req: EmergencyResolveRequest
):
    """
    Marks an active emergency alert as Resolved with notes and auditor info.
    """
    updated = await FirestoreEmergencyService.resolve_sos_event(
        event_id=id,
        resolved_by=req.resolvedBy,
        resolution_notes=req.resolutionNotes
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Emergency event not found")

    return EmergencyEventResponse(**updated)


# ─────────────────────────────────────────────────────────────
# 3. FCM Device Push Token Registration & Diagnostics
# ─────────────────────────────────────────────────────────────

@router.get(
    "/notifications/status",
    summary="Get Push Notification Registration Status for Authenticated User"
)
async def get_notification_status(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Returns actual active push tokens registered under the authenticated user.
    Enables frontend to verify real backend push registration status.
    """
    uid = current_user.get("uid") or current_user.get("id")
    tokens = await FirestoreEmergencyService.get_patient_device_tokens(uid)
    active_tokens = [t for t in tokens if t.get("active", True)]
    return {
        "registered": len(active_tokens) > 0,
        "activeCount": len(active_tokens),
        "devices": [
            {
                "tokenHash": t.get("tokenHash"),
                "deviceType": t.get("deviceType", "web"),
                "deviceName": t.get("deviceName", "Browser"),
                "registeredAt": t.get("registeredAt")
            }
            for t in active_tokens
        ]
    }

@router.post(
    "/notifications/register-device",
    summary="Register Device Token for Push Notifications"
)
async def register_device_token(
    req: DeviceTokenRegisterRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Registers an FCM device token for push notification delivery.
    Associates token with the authenticated user and optionally an emergency contact.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not req.consentGranted:
        raise HTTPException(status_code=400, detail="Notification consent is required")

    result = await FirestoreEmergencyService.register_device_token(
        uid=uid,
        fcm_token=req.fcmToken,
        device_type=req.deviceType or "web",
        device_name=req.deviceName or "Browser",
        contact_id=req.contactId
    )

    return {
        "success": True,
        "message": "Device successfully registered for Emergency SOS push notifications",
        "tokenHash": result.get("tokenHash")
    }


@router.post(
    "/notifications/test-push",
    summary="Send Test Push Notification to Verify FCM Integration"
)
async def test_push_notification(
    data: Dict[str, str],
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Sends a test push notification to a specified device token to verify client setup.
    """
    token = data.get("fcmToken")
    if not token:
        raise HTTPException(status_code=400, detail="fcmToken is required")

    res = FCMService.send_test_notification(token)
    return res


@router.delete(
    "/notifications/device/{token}",
    summary="Unregister Device Push Token"
)
async def delete_device_token(
    token: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Unregisters and invalidates an FCM device token.
    """
    uid = current_user.get("uid") or current_user.get("id")
    success = await FirestoreEmergencyService.delete_device_token(uid, token)
    return {"success": success, "message": "Device token removed"}
