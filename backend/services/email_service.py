"""
Emergency Email Alert Service for GramCare AI
Provides provider-agnostic dispatch of Emergency SOS emails to family contacts.

Supported Delivery Modes:
1. 'firebase_trigger_email' (Default):
   Writes structured email job documents to the Firestore 'mail' collection.
   Picked up and dispatched by the official Firebase 'Trigger Email from Firestore' extension.
2. 'smtp':
   Sends directly using standard outgoing SMTP server configuration (e.g. Gmail SMTP, SendGrid, Amazon SES).
3. 'email_not_configured':
   Gracefully handles missing email configuration without crashing the SOS pipeline.

Zero Fake Data Directive:
- Uses real recipient emails from active emergency contacts.
- Never fabricates GPS coordinates or medical records.
- If GPS is unavailable, clearly indicates 'Location unavailable'.
"""
import os
import re
import smtplib
import logging
import secrets
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Dict, Any, Optional, Tuple, List

from services.firebase_admin import get_firestore_client

logger = logging.getLogger("gramcare.email_service")

# Standard RFC-compliant email validation pattern
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


def normalize_email(email: Optional[str]) -> Optional[str]:
    """
    Normalizes an email address: trims whitespace and converts to lowercase.
    """
    if not email or not isinstance(email, str):
        return None
    cleaned = email.strip().lower()
    return cleaned if cleaned else None


def is_valid_email(email: Optional[str]) -> bool:
    """
    Validates email format strictly. Rejects invalid formats.
    """
    norm = normalize_email(email)
    if not norm:
        return False
    if len(norm) > 254:
        return False
    return bool(EMAIL_REGEX.match(norm))


class EmailService:
    """
    Provider abstraction for dispatching Emergency SOS alerts via email.
    """

    @classmethod
    def get_provider_name(cls) -> str:
        """
        Determines the active email provider from environment.
        """
        configured_provider = os.getenv("EMAIL_PROVIDER", "").strip().lower()
        if configured_provider == "smtp":
            return "smtp"
        if configured_provider in ("none", "disabled", "unconfigured", "off", "email_not_configured", "unconfigured_provider"):
            return "email_not_configured"
        # Default to firebase_trigger_email
        return "firebase_trigger_email"

    @classmethod
    def build_emergency_email_content(
        cls,
        patient_name: str,
        event_id: str,
        location: Optional[Dict[str, Any]] = None,
        patient_phone: Optional[str] = None,
        timestamp: Optional[str] = None,
        notes: Optional[str] = None,
        severity: str = "CRITICAL"
    ) -> Tuple[str, str, str]:
        """
        Builds professional plain-text and HTML emergency email messages.
        Subject: 🚨 EMERGENCY ALERT — [Patient Name] Needs Help
        """
        display_name = (patient_name or "A GramCare patient").strip()
        ts_str = timestamp or datetime.now().strftime("%Y-%m-%d %H:%M:%S UTC")

        subject = f"🚨 EMERGENCY ALERT — {display_name} Needs Help"

        # Handle Location (Never fabricate coordinates)
        maps_link: Optional[str] = None
        location_text = "Location unavailable."
        lat = location.get("latitude") if location else None
        lng = location.get("longitude") if location else None

        if lat is not None and lng is not None:
            try:
                lat_float = float(lat)
                lng_float = float(lng)
                maps_link = f"https://www.google.com/maps?q={lat_float},{lng_float}"
                acc = location.get("accuracyMeters") or location.get("accuracy")
                acc_str = f" (Accuracy: ±{int(acc)}m)" if acc else ""
                addr = location.get("address")
                addr_str = f" - {addr}" if addr else ""
                location_text = f"{lat_float:.6f}, {lng_float:.6f}{acc_str}{addr_str}"
            except (ValueError, TypeError):
                location_text = "Location unavailable."

        phone_str = patient_phone.strip() if patient_phone else "Not provided"
        notes_str = f"\nPatient Notes: {notes.strip()}\n" if notes else ""

        # 1. Plain Text Version
        text_body = f"""🚨 GRAMCARE AI EMERGENCY ALERT
==================================================
An emergency alert has been triggered.

Patient: {display_name}
Date & Time: {ts_str}
Emergency Alert ID: {event_id}
Severity: {severity}

Location:
{location_text}
"""
        if maps_link:
            text_body += f"\n📍 View Patient Location on Google Maps:\n{maps_link}\n"

        text_body += f"""
Patient Contact: {phone_str}{notes_str}
==================================================
ACTION REQUIRED:
Please contact the patient or local emergency services (112 / 108) immediately.

This email was automatically generated by the GramCare AI Emergency Alert System.
Rural Health Companion & Emergency Triage.
"""

        # 2. Responsive HTML Version
        maps_button_html = ""
        if maps_link:
            maps_button_html = f"""
            <div style="margin: 20px 0; text-align: center;">
              <a href="{maps_link}" target="_blank" rel="noopener noreferrer" style="background-color: #dc2626; color: #ffffff; padding: 14px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 15px; display: inline-block; letter-spacing: 0.5px;">
                📍 View Patient Location on Google Maps
              </a>
            </div>
            """

        html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 2px solid #ef4444; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);">
    
    <!-- Red Alert Header -->
    <div style="background-color: #dc2626; color: #ffffff; padding: 24px 20px; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: 0.5px;">
        🚨 EMERGENCY ALERT
      </h1>
      <p style="margin: 6px 0 0 0; font-size: 15px; opacity: 0.95; font-weight: 600;">
        {display_name} has triggered an SOS alert
      </p>
    </div>

    <!-- Alert Body Content -->
    <div style="padding: 24px 20px;">
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
        <strong style="color: #991b1b; font-size: 14px;">Urgent:</strong>
        <span style="color: #7f1d1d; font-size: 14px;"> Please contact the patient or emergency services immediately.</span>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 140px; font-weight: 600;">Patient Name</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 700;">{display_name}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Date & Time</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a;">{ts_str}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Alert ID</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-family: monospace;">{event_id}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">Patient Phone</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a;">{phone_str}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #64748b; font-weight: 600;">GPS Location</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #0f172a;">{location_text}</td>
        </tr>
      </table>

      {maps_button_html}

      <!-- Emergency Helpline Numbers -->
      <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; margin-top: 24px; text-align: center;">
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #334155; text-transform: uppercase;">
          National Emergency Helplines (India)
        </p>
        <p style="margin: 0; font-size: 15px; font-weight: 800; color: #0f766e;">
          📞 112 (All Emergencies) &bull; 🚑 108 (Ambulance)
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px 20px; text-align: center; font-size: 12px; color: #64748b;">
      <p style="margin: 0 0 4px 0;">This email was sent by <strong>GramCare AI Emergency Alert System</strong>.</p>
      <p style="margin: 0;">Rural Healthcare Companion & Emergency Triage Platform.</p>
    </div>

  </div>
</body>
</html>
"""
        return subject, text_body, html_body

    @classmethod
    async def send_emergency_email(
        cls,
        recipient_email: str,
        emergency_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Dispatches an emergency alert email to a single recipient email.
        Supports Firebase Trigger Email extension (default) or SMTP.
        Never throws unhandled exceptions that could crash the SOS flow.
        """
        normalized_email = normalize_email(recipient_email)
        now_iso = datetime.now().isoformat()

        if not is_valid_email(normalized_email):
            logger.warning(f"Invalid recipient email provided: {recipient_email}")
            return {
                "success": False,
                "email": recipient_email,
                "status": "failed",
                "error": "Invalid email address format",
                "timestamp": now_iso
            }

        patient_name = emergency_data.get("patientName", "GramCare Patient")
        event_id = emergency_data.get("eventId") or emergency_data.get("id", "sos_unknown")
        location = emergency_data.get("location")
        patient_phone = emergency_data.get("patientPhone")
        timestamp = emergency_data.get("timestamp") or now_iso
        notes = emergency_data.get("notes")
        severity = emergency_data.get("severity", "CRITICAL")
        patient_uid = emergency_data.get("patientUid", "")

        subject, text_body, html_body = cls.build_emergency_email_content(
            patient_name=patient_name,
            event_id=event_id,
            location=location,
            patient_phone=patient_phone,
            timestamp=timestamp,
            notes=notes,
            severity=severity
        )

        provider = cls.get_provider_name()

        if provider == "email_not_configured":
            return {
                "success": False,
                "email": normalized_email,
                "status": "email_not_configured",
                "error": "Email delivery provider is unconfigured or disabled.",
                "timestamp": now_iso
            }

        # ─────────────────────────────────────────────────────────────
        # Mode 1: Direct Outgoing SMTP
        # ─────────────────────────────────────────────────────────────
        if provider == "smtp":
            smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
            smtp_port_raw = os.getenv("SMTP_PORT", "587").strip()
            smtp_user = os.getenv("SMTP_USERNAME", "").strip()
            smtp_pass = os.getenv("SMTP_PASSWORD", "").strip()
            raw_email_from = os.getenv("EMAIL_FROM", "").strip() or smtp_user or "alerts@gramcare.ai"

            # Detect missing or unconfigured placeholder credentials
            is_placeholder_pass = not smtp_pass or smtp_pass in (
                "YOUR_GOOGLE_APP_PASSWORD",
                "your-google-app-password",
                "YOUR_APP_PASSWORD",
                "change_this_to_app_password"
            )
            is_placeholder_user = not smtp_user or smtp_user in (
                "YOUR_GMAIL@gmail.com",
                "your-sender@gmail.com"
            )

            if not smtp_host or is_placeholder_user or is_placeholder_pass:
                logger.warning("SMTP selected as EMAIL_PROVIDER but SMTP_USERNAME or Google App Password is not yet configured.")
                return {
                    "success": False,
                    "email": normalized_email,
                    "status": "email_not_configured",
                    "error": "Gmail SMTP configuration incomplete (missing SMTP_USERNAME or Google App Password).",
                    "timestamp": now_iso
                }

            try:
                smtp_port = int(smtp_port_raw)
            except ValueError:
                smtp_port = 587

            # Parse envelope sender and RFC From header
            envelope_sender = smtp_user
            if "<" in raw_email_from and ">" in raw_email_from:
                try:
                    envelope_sender = raw_email_from.split("<")[1].split(">")[0].strip()
                    from_header = raw_email_from
                except Exception:
                    envelope_sender = smtp_user
                    from_header = f"GramCare AI Emergency <{smtp_user}>"
            elif "@" in raw_email_from:
                envelope_sender = raw_email_from
                from_header = f"GramCare AI Emergency <{raw_email_from}>"
            else:
                envelope_sender = smtp_user
                from_header = f"GramCare AI Emergency <{smtp_user}>"

            server = None
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = from_header
                msg["To"] = normalized_email

                part1 = MIMEText(text_body, "plain", "utf-8")
                part2 = MIMEText(html_body, "html", "utf-8")
                msg.attach(part1)
                msg.attach(part2)

                server = smtplib.SMTP(smtp_host, smtp_port, timeout=12)
                use_tls = os.getenv("SMTP_USE_TLS", "true").lower() in ("true", "1", "yes")
                if use_tls:
                    server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(envelope_sender, [normalized_email], msg.as_string())

                logger.info(f"Emergency SOS email delivered via SMTP to {normalized_email}")
                return {
                    "success": True,
                    "email": normalized_email,
                    "status": "sent",
                    "provider": "smtp",
                    "timestamp": now_iso
                }
            except Exception as e:
                err_msg = str(e)
                # Ensure password is never exposed in error string or logs
                if smtp_pass and smtp_pass in err_msg:
                    err_msg = err_msg.replace(smtp_pass, "******")
                logger.error(f"SMTP delivery failed to {normalized_email}: {err_msg}")
                return {
                    "success": False,
                    "email": normalized_email,
                    "status": "failed",
                    "error": f"SMTP dispatch error: {err_msg}",
                    "timestamp": now_iso
                }
            finally:
                if server:
                    try:
                        server.quit()
                    except Exception:
                        pass

        # ─────────────────────────────────────────────────────────────
        # Mode 2: Firebase Firestore Trigger Email Extension (Default)
        # ─────────────────────────────────────────────────────────────
        db = get_firestore_client()
        job_id = f"mail_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(4)}"

        mail_job_doc = {
            "to": [normalized_email],
            "message": {
                "subject": subject,
                "text": text_body,
                "html": html_body
            },
            "createdAt": now_iso,
            "status": "pending",
            "metadata": {
                "alertId": event_id,
                "patientUid": patient_uid,
                "patientName": patient_name,
                "source": "GramCare AI SOS"
            }
        }

        if db:
            try:
                db.collection("mail").document(job_id).set(mail_job_doc)
                logger.info(f"Created Firebase Trigger Email job mail/{job_id} for {normalized_email}")
                return {
                    "success": True,
                    "email": normalized_email,
                    "status": "queued",
                    "mailJobId": job_id,
                    "provider": "firebase_trigger_email",
                    "timestamp": now_iso
                }
            except Exception as e:
                logger.warning(f"Failed to write mail document mail/{job_id}: {e}")
                return {
                    "success": False,
                    "email": normalized_email,
                    "status": "failed",
                    "error": f"Firestore mail collection write error: {str(e)}",
                    "timestamp": now_iso
                }

        # If neither Firestore is active nor SMTP is configured
        logger.info(f"Email delivery attempted to {normalized_email} but no email provider is connected.")
        return {
            "success": False,
            "email": normalized_email,
            "status": "email_not_configured",
            "error": "Firebase Trigger Email extension or SMTP provider is not configured.",
            "timestamp": now_iso
        }

    @classmethod
    async def send_emergency_email_to_recipients(
        cls,
        recipients: List[Dict[str, Any]],
        patient_name: str,
        event_id: str,
        location: Optional[Dict[str, Any]] = None,
        patient_phone: Optional[str] = None,
        timestamp: Optional[str] = None,
        notes: Optional[str] = None,
        severity: str = "CRITICAL"
    ) -> Dict[str, Any]:
        """
        Dispatches emergency alert emails to multiple recipients with automatic normalization
        and email deduplication. If multiple contacts share the exact same email, sends only ONE email job,
        while maintaining individual contact delivery records.
        """
        sent_emails: Dict[str, Dict[str, Any]] = {}
        recipient_records: List[Dict[str, Any]] = []
        queued_count = 0
        sent_count = 0
        failed_count = 0
        unconfigured_count = 0

        emergency_payload = {
            "patientName": patient_name,
            "eventId": event_id,
            "location": location,
            "patientPhone": patient_phone,
            "timestamp": timestamp,
            "notes": notes,
            "severity": severity
        }

        for r in recipients:
            raw_email = r.get("email")
            norm_email = normalize_email(raw_email)
            contact_id = r.get("contactId")
            contact_name = r.get("contactName")

            if not norm_email or not is_valid_email(norm_email):
                continue

            if norm_email in sent_emails:
                cached = sent_emails[norm_email]
                recipient_records.append({
                    "contactId": contact_id,
                    "contactName": contact_name,
                    "email": norm_email,
                    "status": cached.get("status", "queued"),
                    "mailJobId": cached.get("mailJobId"),
                    "error": cached.get("error"),
                    "timestamp": datetime.now().isoformat()
                })
            else:
                res = await cls.send_emergency_email(norm_email, emergency_payload)
                sent_emails[norm_email] = res
                st = res.get("status", "queued")
                if st == "queued":
                    queued_count += 1
                elif st == "sent":
                    sent_count += 1
                elif st == "email_not_configured":
                    unconfigured_count += 1
                else:
                    failed_count += 1

                recipient_records.append({
                    "contactId": contact_id,
                    "contactName": contact_name,
                    "email": norm_email,
                    "status": st,
                    "mailJobId": res.get("mailJobId"),
                    "error": res.get("error"),
                    "timestamp": datetime.now().isoformat()
                })

        return {
            "attempted": bool(recipient_records),
            "totalRecipients": len(sent_emails),
            "queued": queued_count,
            "sent": sent_count,
            "failed": failed_count,
            "unconfigured": unconfigured_count,
            "recipients": recipient_records
        }
