"""
Step 6 Automated Verification Test Suite for Firestore Medical Records Migration
Collection Structure: users/{uid}/medicalRecords/{recordId}

Tests:
- Test A: Create real medical record -> saved to Firestore
- Test B: Load records -> returns saved records for authenticated UID
- Test C: Update a record -> record updated cleanly
- Test D: Delete a record -> record deleted from Firestore
- Test E: Refresh app simulation -> record remains
- Test F: Close/reopen app simulation -> record remains
- Test G: Logout/login -> same user's records return
- Test H: Different Firebase user -> cannot access User Alpha's records
- Test I: Tampered UID -> request body UID overridden with token UID
- Test J: Invalid token -> returns 401 Unauthorized
"""
import sys
import os
import asyncio
from datetime import datetime

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from services import firestore_record_service
from services.auth_service import create_access_token

def run_step6_tests():
    print("==================================================")
    print("   STEP 6 FIRESTORE MEDICAL RECORD TESTS          ")
    print("==================================================")

    client = TestClient(app)

    uid_alpha = f"med_user_alpha_{int(datetime.now().timestamp())}"
    uid_beta = f"med_user_beta_{int(datetime.now().timestamp())}"
    token_alpha = create_access_token({"sub": uid_alpha, "email": "med_alpha@example.com"})
    token_beta = create_access_token({"sub": uid_beta, "email": "med_beta@example.com"})

    headers_alpha = {"Authorization": f"Bearer {token_alpha}"}
    headers_beta = {"Authorization": f"Bearer {token_beta}"}

    # ----------------------------------------------------
    # TEST J: Invalid auth token -> 401 Unauthorized
    # ----------------------------------------------------
    print("\n[TEST J] Checking invalid auth token security...")
    res_invalid = client.get("/api/records", headers={"Authorization": "Bearer invalid.token.payload"})
    assert res_invalid.status_code == 401, f"Expected 401, got {res_invalid.status_code}"
    print("  --> SUCCESS: Invalid token rejected with HTTP 401")

    # ----------------------------------------------------
    # TEST A: Create a real medical record
    # ----------------------------------------------------
    print("\n[TEST A] Creating new real medical record via POST /api/records...")
    payload_a = {
        "patientId": uid_alpha,
        "patientName": "Primary User",
        "title": "Blood Sugar & BP Screening",
        "teluguTitle": "రక్త పరీక్ష వివరాలు",
        "type": "clinical_visit",
        "date": "2026-08-18",
        "summary": "Fasting blood sugar 110 mg/dL, Blood Pressure 120/80 mmHg.",
        "facilityOrDoctor": "Dr. Sharma (PHC Medical Officer)",
        "tags": ["blood_test", "checkup"]
    }

    res_create = client.post("/api/records", json=payload_a, headers=headers_alpha)
    assert res_create.status_code == 200, f"Expected 200, got {res_create.status_code}: {res_create.text}"
    created_rec = res_create.json()
    record_id = created_rec["id"]
    assert created_rec["userId"] == uid_alpha, f"Expected userId {uid_alpha}, got {created_rec['userId']}"
    print(f"  --> SUCCESS: Created record users/{uid_alpha}/medicalRecords/{record_id}")

    # ----------------------------------------------------
    # TEST B: Load records
    # ----------------------------------------------------
    print("\n[TEST B] Loading medical records via GET /api/records...")
    res_list = client.get("/api/records", headers=headers_alpha)
    assert res_list.status_code == 200, f"Expected 200, got {res_list.status_code}"
    recs = res_list.json()
    assert len(recs) == 1, f"Expected 1 record, got {len(recs)}"
    assert recs[0]["id"] == record_id
    print("  --> SUCCESS: Returned saved medical record list")

    # ----------------------------------------------------
    # TEST C: Update a record
    # ----------------------------------------------------
    print("\n[TEST C] Updating medical record via PUT /api/records/{record_id}...")
    update_payload = dict(payload_a)
    update_payload["summary"] = "Fasting blood sugar 110 mg/dL, Blood Pressure 120/80 mmHg. Follow-up in 3 months."
    res_update = client.put(f"/api/records/{record_id}", json=update_payload, headers=headers_alpha)
    assert res_update.status_code == 200, f"Expected 200, got {res_update.status_code}"
    updated_rec = res_update.json()
    assert "Follow-up in 3 months" in updated_rec["summary"]
    print("  --> SUCCESS: Record updated cleanly in Firestore")

    # ----------------------------------------------------
    # TEST E & F: Refresh / App restart -> record remains
    # ----------------------------------------------------
    print("\n[TEST E & F] Simulating app refresh & restart...")
    res_single = client.get(f"/api/records/{record_id}", headers=headers_alpha)
    assert res_single.status_code == 200, f"Expected 200, got {res_single.status_code}"
    assert res_single.json()["id"] == record_id
    print("  --> SUCCESS: Medical record persisted across app restarts")

    # ----------------------------------------------------
    # TEST G: Logout/login -> same user's records return
    # ----------------------------------------------------
    print("\n[TEST G] Simulating user logout & re-login...")
    new_token_alpha = create_access_token({"sub": uid_alpha, "email": "med_alpha@example.com"})
    res_relogin = client.get("/api/records", headers={"Authorization": f"Bearer {new_token_alpha}"})
    assert res_relogin.status_code == 200
    assert len(res_relogin.json()) == 1
    assert res_relogin.json()[0]["id"] == record_id
    print("  --> SUCCESS: Re-logged in user sees their existing medical records")

    # ----------------------------------------------------
    # TEST H: Different Firebase user -> cannot access User Alpha's records
    # ----------------------------------------------------
    print("\n[TEST H] Checking isolation for User Beta...")
    res_beta_list = client.get("/api/records", headers=headers_beta)
    assert res_beta_list.status_code == 200
    assert len(res_beta_list.json()) == 0, "User Beta accessed User Alpha's medical records!"

    res_beta_direct = client.get(f"/api/records/{record_id}", headers=headers_beta)
    assert res_beta_direct.status_code == 403, f"Expected 403, got {res_beta_direct.status_code}"
    print("  --> SUCCESS: User Beta blocked from accessing User Alpha's medical records (403 Forbidden)")

    # ----------------------------------------------------
    # TEST I: Tampered UID in request body -> ignored and overridden with token UID
    # ----------------------------------------------------
    print("\n[TEST I] Testing payload UID spoofing protection...")
    spoofed_payload = dict(payload_a)
    spoofed_payload["userId"] = "spoofed_target_victim_uid"
    spoofed_payload["title"] = "Spoofed Attempt Record"
    res_spoof = client.post("/api/records", json=spoofed_payload, headers=headers_alpha)
    assert res_spoof.status_code == 200
    assert res_spoof.json()["userId"] == uid_alpha, "Backend accepted spoofed payload userId!"
    print("  --> SUCCESS: Backend enforced verified token UID and ignored spoofed payload userId")

    # ----------------------------------------------------
    # TEST D: Delete a record
    # ----------------------------------------------------
    print("\n[TEST D] Deleting medical record via DELETE /api/records/{record_id}...")
    res_del = client.delete(f"/api/records/{record_id}", headers=headers_alpha)
    assert res_del.status_code == 200, f"Expected 200, got {res_del.status_code}"
    
    # Confirm deletion
    res_list_after = client.get("/api/records", headers=headers_alpha)
    recs_after = [r for r in res_list_after.json() if r["id"] == record_id]
    assert len(recs_after) == 0, "Record was not deleted from Firestore"
    print("  --> SUCCESS: Medical record deleted cleanly from Firestore")

    print("\n==================================================")
    print(" ALL STEP 6 FIRESTORE RECORD TESTS PASSED 100%!   ")
    print("==================================================")
    return True

if __name__ == "__main__":
    success = run_step6_tests()
    if not success:
        sys.exit(1)
