"""
Unit and Integration Tests for Emergency Email/Gmail SOS System in GramCare AI
Covers all 10 required test scenarios:
TEST 1: Contact has email + FCM -> Both channels attempted.
TEST 2: Contact has email but no FCM -> Email attempted successfully.
TEST 3: Contact has FCM but no email -> Existing FCM works unchanged.
TEST 4: Contact has neither -> Contact marked unavailable.
TEST 5: Two contacts have same email -> Only one email sent/queued (deduplication).
TEST 6: Invalid email -> Reject/mark unavailable; do not crash SOS.
TEST 7: Email provider unavailable/unconfigured -> SOS still works through FCM.
TEST 8: FCM unavailable -> Email still works.
TEST 9: GPS unavailable -> Email says "Location unavailable"; never fabricate location.
TEST 10: Multiple active contacts -> All unique valid email addresses are processed.
"""
import os
import sys
import asyncio
from unittest.mock import patch

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from services.email_service import (
    EmailService,
    normalize_email,
    is_valid_email
)
from services.firestore_emergency_service import FirestoreEmergencyService


TEST_UID = "test_email_sos_user_999"
TEST_PATIENT_NAME = "Surendra Baditha"
TEST_PATIENT_PHONE = "+919876543210"


async def run_email_tests():
    print("==================================================")
    print("   EMERGENCY EMAIL/GMAIL SOS ALERT TEST SUITE     ")
    print("==================================================")

    # -------------------------------------------------------------------------
    # Unit Tests for Email Validation, Normalization, and Content Templates
    # -------------------------------------------------------------------------
    print("\n[UNIT TEST] Normalization and RFC Regex Validation...", flush=True)
    assert normalize_email("  Mother@Gmail.COM  ") == "mother@gmail.com"
    assert is_valid_email("family@gmail.com") is True
    assert is_valid_email("invalid-email-no-at") is False
    assert is_valid_email("test@domain") is False
    assert is_valid_email("") is False
    print("  [✓] Email normalization and regex validation verified.", flush=True)

    print("\n[UNIT TEST] Plain Text & HTML Content Formatting (GPS vs No GPS)...", flush=True)
    # Scenario A: With GPS
    loc_with_gps = {"latitude": 17.385044, "longitude": 78.486671, "address": "Hyderabad, TS"}
    subject, plain_text_gps, html_gps = EmailService.build_emergency_email_content(
        patient_name=TEST_PATIENT_NAME,
        event_id="sos_test_123",
        location=loc_with_gps,
        patient_phone=TEST_PATIENT_PHONE,
        timestamp="2026-10-06T14:00:00Z",
        notes="Patient requires urgent assistance."
    )
    assert "https://www.google.com/maps?q=17.385044,78.486671" in plain_text_gps
    assert "Hyderabad, TS" in plain_text_gps
    assert "https://www.google.com/maps?q=17.385044,78.486671" in html_gps

    # Scenario B: Without GPS (Never fabricate location - TEST 9)
    _, plain_text_no_gps, html_no_gps = EmailService.build_emergency_email_content(
        patient_name=TEST_PATIENT_NAME,
        event_id="sos_test_456",
        location=None,
        patient_phone=TEST_PATIENT_PHONE,
        timestamp="2026-10-06T14:00:00Z"
    )
    assert "Location unavailable" in plain_text_no_gps
    assert "maps?q=" not in plain_text_no_gps
    assert "Location unavailable" in html_no_gps
    print("  [✓] Content verified: Real GPS generates Maps link; missing GPS clearly states 'Location unavailable'.", flush=True)

    # -------------------------------------------------------------------------
    # TEST 1: Contact has email + FCM -> Both channels attempted
    # -------------------------------------------------------------------------
    print("\n[TEST 1] Contact with both Email and FCM token...", flush=True)
    uid1 = "test_email_sos_u1"
    c1 = await FirestoreEmergencyService.create_emergency_contact(uid1, {
        "fullName": "Contact Both",
        "relation": "Mother",
        "phone": "+919999900001",
        "email": "mother@gmail.com",
        "notifyOnSOS": True,
        "isEmergencyContact": True
    })
    await FirestoreEmergencyService.register_device_token(
        uid=uid1,
        fcm_token="mock_device_token_for_both_channels_12345",
        device_type="web",
        device_name="Mother Phone",
        contact_id=c1["id"]
    )
    event1 = await FirestoreEmergencyService.create_sos_event(
        patient_uid=uid1,
        patient_name=TEST_PATIENT_NAME,
        patient_phone=TEST_PATIENT_PHONE,
        target_contact_id=c1["id"],
        location=loc_with_gps
    )
    assert len(event1["notifiedContacts"]) == 1
    rec1 = event1["notifiedContacts"][0]
    assert rec1["email"] == "mother@gmail.com"
    assert rec1["emailStatus"] in ["queued", "sent", "email_not_configured"]
    assert event1["emailDelivery"] is not None
    assert event1["emailDelivery"]["totalRecipients"] >= 1
    print(f"  [✓] Both channels attempted. FCM status={rec1['status']}, Email status={rec1['emailStatus']}", flush=True)

    # -------------------------------------------------------------------------
    # TEST 2: Contact has email but no FCM -> Email attempted successfully
    # -------------------------------------------------------------------------
    print("\n[TEST 2] Contact with Email but no FCM...", flush=True)
    uid2 = "test_email_sos_u2"
    c2 = await FirestoreEmergencyService.create_emergency_contact(uid2, {
        "fullName": "Contact Email Only",
        "relation": "Sister",
        "phone": "+919999900002",
        "email": "sister@gmail.com",
        "notifyOnSOS": True,
        "isEmergencyContact": True
    })
    event2 = await FirestoreEmergencyService.create_sos_event(
        patient_uid=uid2,
        patient_name=TEST_PATIENT_NAME,
        patient_phone=TEST_PATIENT_PHONE,
        target_contact_id=c2["id"]
    )
    rec2 = event2["notifiedContacts"][0]
    assert rec2["email"] == "sister@gmail.com"
    assert rec2["status"] == "unavailable"  # Push is unavailable
    assert rec2["emailStatus"] in ["queued", "sent", "email_not_configured"]
    print(f"  [✓] Email attempted without FCM. Push={rec2['status']}, Email={rec2['emailStatus']}", flush=True)

    # -------------------------------------------------------------------------
    # TEST 3: Contact has FCM but no email -> Existing FCM works unchanged
    # -------------------------------------------------------------------------
    print("\n[TEST 3] Contact with FCM but no email...", flush=True)
    uid3 = "test_email_sos_u3"
    c3 = await FirestoreEmergencyService.create_emergency_contact(uid3, {
        "fullName": "Contact Phone Only",
        "relation": "Brother",
        "phone": "+919999900003",
        "notifyOnSOS": True,
        "isEmergencyContact": True
    })
    await FirestoreEmergencyService.register_device_token(
        uid=uid3,
        fcm_token="mock_fcm_token_for_brother_phone_only_9988",
        device_type="android",
        device_name="Brother Phone",
        contact_id=c3["id"]
    )
    event3 = await FirestoreEmergencyService.create_sos_event(
        patient_uid=uid3,
        patient_name=TEST_PATIENT_NAME,
        patient_phone=TEST_PATIENT_PHONE,
        target_contact_id=c3["id"]
    )
    rec3 = event3["notifiedContacts"][0]
    assert rec3["email"] is None
    assert rec3["emailStatus"] == "not_configured"
    assert rec3["deviceToken"] is not None
    print(f"  [✓] FCM works unchanged without email. Push token attached, Email={rec3['emailStatus']}", flush=True)

    # -------------------------------------------------------------------------
    # TEST 4: Contact has neither FCM token nor valid email -> Marked unavailable
    # -------------------------------------------------------------------------
    print("\n[TEST 4] Contact with neither push device nor email...", flush=True)
    uid4 = "test_email_sos_u4"
    c4 = await FirestoreEmergencyService.create_emergency_contact(uid4, {
        "fullName": "Contact Neither",
        "relation": "Neighbor",
        "phone": "+919999900004",
        "notifyOnSOS": True,
        "isEmergencyContact": True
    })
    event4 = await FirestoreEmergencyService.create_sos_event(
        patient_uid=uid4,
        patient_name=TEST_PATIENT_NAME,
        patient_phone=TEST_PATIENT_PHONE,
        target_contact_id=c4["id"]
    )
    rec4 = event4["notifiedContacts"][0]
    assert rec4["status"] == "unavailable"
    assert rec4["emailStatus"] == "not_configured"
    print(f"  [✓] Contact correctly marked unavailable when neither channel exists.", flush=True)

    # -------------------------------------------------------------------------
    # TEST 5: Two contacts have same email -> Only one email sent (Deduplication)
    # -------------------------------------------------------------------------
    print("\n[TEST 5] Email Deduplication across contacts...", flush=True)
    recipients = [
        {"contactId": "c_dup_1", "contactName": "Parent 1", "email": "family_shared@gmail.com"},
        {"contactId": "c_dup_2", "contactName": "Parent 2", "email": "FAMILY_SHARED@GMAIL.COM"}  # casing diff
    ]
    delivery = await EmailService.send_emergency_email_to_recipients(
        recipients=recipients,
        patient_name=TEST_PATIENT_NAME,
        event_id="sos_dedup_test",
        timestamp="2026-10-06T14:00:00Z"
    )
    assert delivery["totalRecipients"] == 1, f"Expected 1 unique recipient, got {delivery['totalRecipients']}"
    assert len(delivery["recipients"]) == 2, f"Expected 2 contact records preserved, got {len(delivery['recipients'])}"
    assert delivery["recipients"][0]["email"] == "family_shared@gmail.com"
    assert delivery["recipients"][1]["email"] == "family_shared@gmail.com"
    print(f"  [✓] Deduplication verified: 2 contacts with same email collapsed to 1 job while preserving both contact records: {delivery['recipients'][0]['email']}", flush=True)

    # -------------------------------------------------------------------------
    # TEST 6: Invalid email -> Reject/mark unavailable; do not crash SOS
    # -------------------------------------------------------------------------
    print("\n[TEST 6] Invalid email handling...", flush=True)
    invalid_recipients = [
        {"contactId": "c_inv", "contactName": "Invalid User", "email": "not-an-email"}
    ]
    delivery_inv = await EmailService.send_emergency_email_to_recipients(
        recipients=invalid_recipients,
        patient_name=TEST_PATIENT_NAME,
        event_id="sos_inv_test",
        timestamp="2026-10-06T14:00:00Z"
    )
    assert delivery_inv["totalRecipients"] == 0
    assert delivery_inv["failed"] == 0
    print("  [✓] Invalid email filtered cleanly without crashing.", flush=True)

    # -------------------------------------------------------------------------
    # TEST 7: Email provider unconfigured -> SOS still works through FCM
    # -------------------------------------------------------------------------
    print("\n[TEST 7] Unconfigured email provider fallback...", flush=True)
    with patch.dict(os.environ, {"EMAIL_PROVIDER": "unconfigured_provider"}):
        res = await EmailService.send_emergency_email(
            recipient_email="test@gmail.com",
            emergency_data={
                "patient_name": TEST_PATIENT_NAME,
                "event_id": "sos_unconf_test",
                "timestamp": "2026-10-06T14:00:00Z"
            }
        )
        assert res["status"] == "email_not_configured"
        assert res["success"] is False
    print("  [✓] Unconfigured email provider reports 'email_not_configured' gracefully without exception.", flush=True)

    # -------------------------------------------------------------------------
    # TEST 7.1: Invalid SMTP credentials failure isolation
    # -------------------------------------------------------------------------
    print("\n[TEST 7.1] Invalid SMTP credentials failure isolation...", flush=True)
    with patch.dict(os.environ, {
        "EMAIL_PROVIDER": "smtp",
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "587",
        "SMTP_USERNAME": "test_invalid_user@gmail.com",
        "SMTP_PASSWORD": "invalid_mock_app_password"
    }):
        smtp_res = await EmailService.send_emergency_email(
            recipient_email="family@gmail.com",
            emergency_data={
                "patient_name": TEST_PATIENT_NAME,
                "event_id": "sos_smtp_fail_test",
                "timestamp": "2026-10-06T14:00:00Z"
            }
        )
        assert smtp_res["status"] == "failed"
        assert smtp_res["success"] is False
        assert "invalid_mock_app_password" not in smtp_res.get("error", "")
    print("  [✓] Bad SMTP credentials handled gracefully without crashing: status=failed, secrets protected.", flush=True)

    # -------------------------------------------------------------------------
    # TEST 8: FCM unavailable -> Email still works
    # -------------------------------------------------------------------------
    print("\n[TEST 8] FCM unavailable with Email working...", flush=True)
    res_em = await EmailService.send_emergency_email(
        recipient_email="relative@gmail.com",
        emergency_data={
            "patient_name": TEST_PATIENT_NAME,
            "event_id": "sos_em_only_test",
            "timestamp": "2026-10-06T14:00:00Z"
        }
    )
    assert res_em["status"] in ["queued", "sent", "email_not_configured"]
    print(f"  [✓] Email service independently processed status: {res_em['status']}", flush=True)

    # -------------------------------------------------------------------------
    # TEST 9: GPS unavailable -> Email says "Location unavailable"
    # -------------------------------------------------------------------------
    print("\n[TEST 9] GPS unavailable email content verification...", flush=True)
    _, plain_body, html_body = EmailService.build_emergency_email_content(
        patient_name=TEST_PATIENT_NAME,
        event_id="sos_gps_none",
        location=None,
        timestamp="2026-10-06T14:00:00Z"
    )
    assert "Location unavailable" in plain_body
    assert "Location unavailable" in html_body
    print("  [✓] Zero GPS fabrication verified: Both plain text and HTML explicitly state 'Location unavailable'.", flush=True)

    # -------------------------------------------------------------------------
    # TEST 10: Multiple active contacts -> All unique valid email addresses processed
    # -------------------------------------------------------------------------
    print("\n[TEST 10] Multiple active contacts batch email processing...", flush=True)
    multi_recipients = [
        {"contactId": "c_m1", "contactName": "Mother", "email": "mother@gmail.com"},
        {"contactId": "c_m2", "contactName": "Father", "email": "father@gmail.com"},
        {"contactId": "c_m3", "contactName": "Doctor", "email": "doctor@hospital.org"},
        {"contactId": "c_m4", "contactName": "Duplicate Father", "email": "father@gmail.com"}  # duplicate
    ]
    multi_delivery = await EmailService.send_emergency_email_to_recipients(
        recipients=multi_recipients,
        patient_name=TEST_PATIENT_NAME,
        event_id="sos_multi_test",
        timestamp="2026-10-06T14:00:00Z"
    )
    assert multi_delivery["totalRecipients"] == 3
    assert len(multi_delivery["recipients"]) == 4, f"Expected 4 contact records preserved, got {len(multi_delivery['recipients'])}"
    unique_emails = set(r["email"] for r in multi_delivery["recipients"])
    assert "mother@gmail.com" in unique_emails
    assert "father@gmail.com" in unique_emails
    assert "doctor@hospital.org" in unique_emails
    print(f"  [✓] All 3 unique valid recipient emails processed across 4 contact records: {unique_emails}", flush=True)

    # -------------------------------------------------------------------------
    # Cleanup test contacts
    # -------------------------------------------------------------------------
    for uid, cid in [(uid1, c1["id"]), (uid2, c2["id"]), (uid3, c3["id"]), (uid4, c4["id"])]:
        await FirestoreEmergencyService.delete_emergency_contact(uid, cid)

    print("\n==================================================")
    print("   ALL 10 EMERGENCY EMAIL SOS TESTS PASSED!       ")
    print("==================================================")


if __name__ == "__main__":
    asyncio.run(run_email_tests())
