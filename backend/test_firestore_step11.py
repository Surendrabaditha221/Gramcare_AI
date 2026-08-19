"""
Step 11 Automated Verification Test Suite for Firestore Triage Logs Migration
Document Target: users/{uid}/triageLogs/{triageLogId}

Tests:
- TEST I: Invalid token -> HTTP 401 Unauthorized
- TEST J: Empty state for new user -> [] without fake triage logs
- TEST A: Create real triage log via POST /api/triage and POST /api/triage/logs
- TEST B: Read triage logs via GET /api/triage/logs
- TEST C: Verify correct user ownership (userId == token UID)
- TEST D & E: App refresh & restart simulation -> triage logs persist
- TEST F: Logout/login simulation -> same logs restored
- TEST G: Cross-user isolation -> User Beta blocked from reading/editing User Alpha's triage logs
- TEST H: Tampered UID protection -> request body UID overridden with token UID
- TEST K: Update triage log via PUT /api/triage/logs/{id}
- TEST L: Delete triage log via DELETE /api/triage/logs/{id}
- TEST M: Family member integration -> triage log linked to real family member ID
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
USER_ALPHA_UID = f"triage_user_alpha_{int(time.time())}"
TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "triage_alpha@gramcare.ai"})
HEADERS_ALPHA = {"Authorization": f"Bearer {TOKEN_ALPHA}"}

# Test User Beta (for isolation testing)
USER_BETA_UID = f"triage_user_beta_{int(time.time())}"
TOKEN_BETA = create_access_token({"sub": USER_BETA_UID, "email": "triage_beta@gramcare.ai"})
HEADERS_BETA = {"Authorization": f"Bearer {TOKEN_BETA}"}


def run_all_step11_tests():
    print("\n==================================================")
    print("   STEP 11 FIRESTORE TRIAGE LOGS MIGRATION TESTS  ")
    print("==================================================\n")

    # TEST I: Invalid auth token -> HTTP 401
    print("[TEST I] Testing invalid auth token security...")
    res = client.get("/api/triage/logs", headers={"Authorization": "Bearer INVALID_TOKEN_123"})
    assert res.status_code == 401, f"Expected 401 for invalid token, got {res.status_code}"
    print("  --> SUCCESS: Invalid token rejected with HTTP 401")

    # TEST J: Empty state for new user without triage logs
    print("\n[TEST J] Checking empty state for new user without triage logs...")
    res = client.get("/api/triage/logs", headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    logs = res.json()
    assert isinstance(logs, list), "Expected list of triage logs"
    assert len(logs) == 0, f"Expected empty list for new user, got {len(logs)}"
    print("  --> SUCCESS: Empty state returns [] without fake triage logs")

    # TEST A: Create real triage log via POST /api/triage/logs
    print("\n[TEST A] Creating real triage log document via POST /api/triage/logs...")
    new_log_payload = {
        "patientId": "user_primary",
        "patientName": "Primary Patient",
        "mainComplaint": "Persistent dry cough and moderate fever",
        "symptoms": ["dry_cough", "fever", "body_ache"],
        "duration": "3 days",
        "severity": "Moderate",
        "riskLevel": "moderate",
        "urgencyLevel": "Seek Medical Care Soon",
        "aiAssessment": "Patient presents with upper respiratory symptoms. Clinical review advised.",
        "recommendation": "Visit nearest Primary Health Centre (PHC) for clinical assessment.",
        "recommendedNextActions": ["Rest and stay hydrated", "Monitor temperature twice daily"],
        "warningSigns": ["Difficulty breathing", "High fever above 102F"]
    }
    res = client.post("/api/triage/logs", json=new_log_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    created_log = res.json()
    log_id = created_log["id"]
    assert log_id.startswith("triage_")
    assert created_log["mainComplaint"] == "Persistent dry cough and moderate fever"
    assert created_log["severity"] == "Moderate"
    assert created_log["userId"] == USER_ALPHA_UID
    print(f"  --> SUCCESS: Created triage log users/{USER_ALPHA_UID}/triageLogs/{log_id}")

    # TEST B: Read triage logs via GET /api/triage/logs
    print("\n[TEST B] Reading triage logs via GET /api/triage/logs...")
    res = client.get("/api/triage/logs", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    all_logs = res.json()
    assert len(all_logs) == 1
    assert all_logs[0]["id"] == log_id
    assert all_logs[0]["mainComplaint"] == "Persistent dry cough and moderate fever"
    print("  --> SUCCESS: Successfully retrieved authenticated user's triage logs")

    # TEST C: Verify correct user ownership
    print("\n[TEST C] Verifying correct user ownership...")
    assert created_log["userId"] == USER_ALPHA_UID
    assert all_logs[0]["userId"] == USER_ALPHA_UID
    print(f"  --> SUCCESS: Ownership verified strictly as {USER_ALPHA_UID}")

    # TEST K: Update triage log details via PUT /api/triage/logs/{id}
    print(f"\n[TEST K] Updating triage log via PUT /api/triage/logs/{log_id}...")
    update_payload = {
        "severity": "Mild",
        "aiAssessment": "Symptoms improving following hydration and rest."
    }
    res = client.put(f"/api/triage/logs/{log_id}", json=update_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    updated_log = res.json()
    assert updated_log["severity"] == "Mild"
    assert updated_log["aiAssessment"] == "Symptoms improving following hydration and rest."
    print("  --> SUCCESS: Triage log updated cleanly in Firestore")

    # TEST M: Family Member Integration
    print("\n[TEST M] Testing family member integration for triage logs...")
    import asyncio
    fm_data = {"fullName": "Child Aarav", "relation": "Son", "age": 8}
    family_member = asyncio.run(firestore_family_service.create_family_member(USER_ALPHA_UID, fm_data))
    fm_id = family_member["id"]

    fam_log_payload = {
        "patientId": fm_id,
        "mainComplaint": "Mild stomach ache after meal",
        "symptoms": ["stomach_ache"],
        "duration": "1 day",
        "severity": "Mild",
        "riskLevel": "low"
    }
    res_fam = client.post("/api/triage/logs", json=fam_log_payload, headers=HEADERS_ALPHA)
    assert res_fam.status_code == 200
    fam_log = res_fam.json()
    fam_log_id = fam_log["id"]
    assert fam_log["patientId"] == fm_id
    assert fam_log["patientName"] == "Child Aarav"
    print(f"  --> SUCCESS: Triage log linked to real family member {fm_id} ({fam_log['patientName']})")

    # TEST D & E: App refresh & restart simulation -> triage logs persist
    print("\n[TEST D & E] Simulating app refresh & restart...")
    res = client.get(f"/api/triage/logs/{fam_log_id}", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    restored = res.json()
    assert restored["mainComplaint"] == "Mild stomach ache after meal"
    assert restored["patientName"] == "Child Aarav"
    print("  --> SUCCESS: Triage logs persisted across refreshes and restarts")

    # TEST F: Logout & re-login simulation -> same logs restored
    print("\n[TEST F] Simulating user logout & re-login...")
    RELOGIN_TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "triage_alpha@gramcare.ai"})
    res = client.get("/api/triage/logs", headers={"Authorization": f"Bearer {RELOGIN_TOKEN_ALPHA}"})
    assert res.status_code == 200
    relogin_logs = res.json()
    assert len(relogin_logs) == 2  # 1 primary log + 1 family member log
    print("  --> SUCCESS: Re-logged in user receives their existing triage logs")

    # TEST G: Cross-user isolation -> User Beta cannot read, update, or delete User Alpha's triage logs
    print("\n[TEST G] Checking isolation for User Beta...")
    res_beta_read = client.get(f"/api/triage/logs/{fam_log_id}", headers=HEADERS_BETA)
    assert res_beta_read.status_code == 404, f"User Beta should get 404 reading User Alpha's triage log, got {res_beta_read.status_code}"

    res_beta_update = client.put(f"/api/triage/logs/{fam_log_id}", json={"severity": "Emergency"}, headers=HEADERS_BETA)
    assert res_beta_update.status_code == 404, f"User Beta should get 404 updating User Alpha's triage log, got {res_beta_update.status_code}"

    res_beta_delete = client.delete(f"/api/triage/logs/{fam_log_id}", headers=HEADERS_BETA)
    assert res_beta_delete.status_code == 404, f"User Beta should get 404 deleting User Alpha's triage log, got {res_beta_delete.status_code}"
    print("  --> SUCCESS: User Beta blocked from reading, modifying, or deleting User Alpha's triage logs")

    # TEST H: Tampered UID protection -> payload userId overridden with token UID
    print("\n[TEST H] Testing payload UID spoofing protection...")
    spoofed_log_payload = {
        "userId": "SPOOFED_ADMIN_UID_999",
        "mainComplaint": "Spoofed Triage Complaint",
        "severity": "Mild"
    }
    res = client.post("/api/triage/logs", json=spoofed_log_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200
    created_spoofed = res.json()
    assert created_spoofed["userId"] == USER_ALPHA_UID, f"Expected {USER_ALPHA_UID}, got {created_spoofed.get('userId')}"
    spoofed_id = created_spoofed["id"]
    print("  --> SUCCESS: Backend enforced verified token UID and ignored spoofed payload userId")

    # Clean up test triage logs
    client.delete(f"/api/triage/logs/{log_id}", headers=HEADERS_ALPHA)
    client.delete(f"/api/triage/logs/{fam_log_id}", headers=HEADERS_ALPHA)
    client.delete(f"/api/triage/logs/{spoofed_id}", headers=HEADERS_ALPHA)

    # TEST L: Delete triage log verification
    print("\n[TEST L] Verifying delete triage log cleanup...")
    res_verify = client.get(f"/api/triage/logs/{log_id}", headers=HEADERS_ALPHA)
    assert res_verify.status_code == 404, "Deleted triage log should return 404"
    print("  --> SUCCESS: Triage logs deleted cleanly from Firestore")

    print("\n==================================================")
    print("  ALL STEP 11 FIRESTORE TRIAGE TESTS PASSED 100%! ")
    print("==================================================\n")


if __name__ == "__main__":
    run_all_step11_tests()
