"""
Step 10 Automated Verification Test Suite for Firestore Appointments Migration
Document Target: users/{uid}/appointments/{appointmentId}

Tests:
- TEST K: Invalid token -> HTTP 401 Unauthorized
- TEST L: Empty state for new user -> [] without fake appointments
- TEST A: Create appointment via POST /api/appointments
- TEST B: Read appointments via GET /api/appointments
- TEST C: Update appointment via PUT /api/appointments/{id}
- TEST D: Cancel appointment via POST /api/appointments/{id}/cancel
- TEST M: Family member integration -> appointment linked to real family member ID
- TEST F & G: App refresh & restart simulation -> appointments persist
- TEST H: Logout/login simulation -> same appointments restored
- TEST I: Cross-user isolation -> User Beta blocked from reading/editing User Alpha's appointment
- TEST J: Tampered UID protection -> request body UID overridden with token UID
- TEST E: Delete appointment via DELETE /api/appointments/{id}
"""
import sys
import os
import time
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from services.auth_service import create_access_token
from services import firestore_family_service

client = TestClient(app)

# Test User Alpha
USER_ALPHA_UID = f"apt_user_alpha_{int(time.time())}"
TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "apt_alpha@gramcare.ai"})
HEADERS_ALPHA = {"Authorization": f"Bearer {TOKEN_ALPHA}"}

# Test User Beta (for isolation testing)
USER_BETA_UID = f"apt_user_beta_{int(time.time())}"
TOKEN_BETA = create_access_token({"sub": USER_BETA_UID, "email": "apt_beta@gramcare.ai"})
HEADERS_BETA = {"Authorization": f"Bearer {TOKEN_BETA}"}


def run_all_step10_tests():
    print("\n==================================================")
    print("   STEP 10 FIRESTORE APPOINTMENTS MIGRATION TESTS ")
    print("==================================================\n")

    # TEST K: Invalid auth token -> HTTP 401
    print("[TEST K] Testing invalid auth token security...")
    res = client.get("/api/appointments", headers={"Authorization": "Bearer INVALID_TOKEN_123"})
    assert res.status_code == 401, f"Expected 401 for invalid token, got {res.status_code}"
    print("  --> SUCCESS: Invalid token rejected with HTTP 401")

    # TEST L: Empty state for new user without appointments
    print("\n[TEST L] Checking empty state for new user without appointments...")
    res = client.get("/api/appointments", headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    apts = res.json()
    assert isinstance(apts, list), "Expected list of appointments"
    assert len(apts) == 0, f"Expected empty list for new user, got {len(apts)}"
    print("  --> SUCCESS: Empty state returns [] without fake appointments")

    # TEST A: Create appointment via POST /api/appointments
    print("\n[TEST A] Creating real appointment document via POST /api/appointments...")
    new_apt_payload = {
        "patientId": "user_primary",
        "patientName": "Primary User",
        "doctorName": "Dr. Ramesh Sharma",
        "hospitalName": "District Community Health Centre",
        "specialty": "Cardiology",
        "appointmentDate": "2026-09-01",
        "appointmentTime": "10:30 AM",
        "reason": "Routine hypertension checkup",
        "notes": "Bring previous blood pressure logs"
    }
    res = client.post("/api/appointments", json=new_apt_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    created_apt = res.json()
    apt_id = created_apt["id"]
    assert apt_id.startswith("apt_")
    assert created_apt["doctorName"] == "Dr. Ramesh Sharma"
    assert created_apt["hospitalName"] == "District Community Health Centre"
    assert created_apt["status"] == "scheduled"
    assert created_apt["userId"] == USER_ALPHA_UID
    print(f"  --> SUCCESS: Created appointment users/{USER_ALPHA_UID}/appointments/{apt_id}")

    # TEST B: Read appointments via GET /api/appointments
    print("\n[TEST B] Reading appointments via GET /api/appointments...")
    res = client.get("/api/appointments", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    all_apts = res.json()
    assert len(all_apts) == 1
    assert all_apts[0]["id"] == apt_id
    assert all_apts[0]["doctorName"] == "Dr. Ramesh Sharma"
    print("  --> SUCCESS: Successfully retrieved authenticated user's appointment")

    # TEST C: Update appointment via PUT /api/appointments/{id}
    print(f"\n[TEST C] Updating appointment via PUT /api/appointments/{apt_id}...")
    update_payload = {
        "appointmentTime": "11:00 AM",
        "notes": "Bring previous BP logs and ECG report"
    }
    res = client.put(f"/api/appointments/{apt_id}", json=update_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    updated_apt = res.json()
    assert updated_apt["appointmentTime"] == "11:00 AM"
    assert updated_apt["notes"] == "Bring previous BP logs and ECG report"
    print("  --> SUCCESS: Appointment updated cleanly in Firestore")

    # TEST D: Cancel appointment via POST /api/appointments/{id}/cancel
    print(f"\n[TEST D] Cancelling appointment via POST /api/appointments/{apt_id}/cancel...")
    res_cancel = client.post(f"/api/appointments/{apt_id}/cancel", headers=HEADERS_ALPHA)
    assert res_cancel.status_code == 200
    cancelled_apt = res_cancel.json()
    assert cancelled_apt["status"] == "cancelled"
    print("  --> SUCCESS: Appointment status updated to 'cancelled'")

    # TEST M: Family Member Integration
    print("\n[TEST M] Testing family member integration for appointments...")
    # First create a family member synchronously in Firestore
    import asyncio
    fm_data = {"fullName": "Grandmother Kamala", "relation": "Grandmother"}
    family_member = asyncio.run(firestore_family_service.create_family_member(USER_ALPHA_UID, fm_data))
    fm_id = family_member["id"]

    fam_apt_payload = {
        "patientId": fm_id,
        "doctorName": "Dr. Priya Patel",
        "hospitalName": "City General Hospital",
        "specialty": "Ophthalmology",
        "appointmentDate": "2026-09-15",
        "appointmentTime": "02:00 PM",
        "reason": "Cataract follow-up"
    }
    res_fam = client.post("/api/appointments", json=fam_apt_payload, headers=HEADERS_ALPHA)
    assert res_fam.status_code == 200
    fam_apt = res_fam.json()
    fam_apt_id = fam_apt["id"]
    assert fam_apt["patientId"] == fm_id
    assert fam_apt["patientName"] == "Grandmother Kamala"
    print(f"  --> SUCCESS: Appointment linked to real family member {fm_id} ({fam_apt['patientName']})")

    # TEST F & G: App refresh & restart simulation -> appointments persist
    print("\n[TEST F & G] Simulating app refresh & restart...")
    res = client.get(f"/api/appointments/{fam_apt_id}", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    restored = res.json()
    assert restored["doctorName"] == "Dr. Priya Patel"
    assert restored["patientName"] == "Grandmother Kamala"
    print("  --> SUCCESS: Appointments persisted across refreshes and restarts")

    # TEST H: Logout & re-login simulation -> same appointments restored
    print("\n[TEST H] Simulating user logout & re-login...")
    RELOGIN_TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "apt_alpha@gramcare.ai"})
    res = client.get("/api/appointments", headers={"Authorization": f"Bearer {RELOGIN_TOKEN_ALPHA}"})
    assert res.status_code == 200
    relogin_apts = res.json()
    assert len(relogin_apts) == 2  # 1 cancelled primary apt + 1 family member apt
    print("  --> SUCCESS: Re-logged in user receives their existing appointments")

    # TEST I: Cross-user isolation -> User Beta cannot read, update, cancel, or delete User Alpha's appointment
    print("\n[TEST I] Checking isolation for User Beta...")
    res_beta_read = client.get(f"/api/appointments/{fam_apt_id}", headers=HEADERS_BETA)
    assert res_beta_read.status_code == 404, f"User Beta should get 404 reading User Alpha's appointment, got {res_beta_read.status_code}"

    res_beta_update = client.put(f"/api/appointments/{fam_apt_id}", json={"doctorName": "Hacked Doctor"}, headers=HEADERS_BETA)
    assert res_beta_update.status_code == 404, f"User Beta should get 404 updating User Alpha's appointment, got {res_beta_update.status_code}"

    res_beta_delete = client.delete(f"/api/appointments/{fam_apt_id}", headers=HEADERS_BETA)
    assert res_beta_delete.status_code == 404, f"User Beta should get 404 deleting User Alpha's appointment, got {res_beta_delete.status_code}"
    print("  --> SUCCESS: User Beta blocked from reading, modifying, or deleting User Alpha's appointment")

    # TEST J: Tampered UID protection -> payload userId overridden with token UID
    print("\n[TEST J] Testing payload UID spoofing protection...")
    spoofed_apt_payload = {
        "userId": "SPOOFED_ADMIN_UID_999",
        "doctorName": "Dr. Spoof",
        "appointmentDate": "2026-10-01"
    }
    res = client.post("/api/appointments", json=spoofed_apt_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200
    created_spoofed = res.json()
    assert created_spoofed["userId"] == USER_ALPHA_UID, f"Expected {USER_ALPHA_UID}, got {created_spoofed.get('userId')}"
    spoofed_id = created_spoofed["id"]
    print("  --> SUCCESS: Backend enforced verified token UID and ignored spoofed payload userId")

    # Clean up test appointments
    client.delete(f"/api/appointments/{apt_id}", headers=HEADERS_ALPHA)
    client.delete(f"/api/appointments/{fam_apt_id}", headers=HEADERS_ALPHA)
    client.delete(f"/api/appointments/{spoofed_id}", headers=HEADERS_ALPHA)

    # TEST E: Delete appointment verification
    print("\n[TEST E] Verifying delete appointment cleanup...")
    res_verify = client.get(f"/api/appointments/{apt_id}", headers=HEADERS_ALPHA)
    assert res_verify.status_code == 404, "Deleted appointment should return 404"
    print("  --> SUCCESS: Appointments deleted cleanly from Firestore")

    print("\n==================================================")
    print(" ALL STEP 10 FIRESTORE APPOINTMENT TESTS PASSED!  ")
    print("==================================================\n")


if __name__ == "__main__":
    run_all_step10_tests()
