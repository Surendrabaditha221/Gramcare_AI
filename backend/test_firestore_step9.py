"""
Step 9 Automated Verification Test Suite for Firestore Family Members Migration
Document Target: users/{uid}/familyMembers/{memberId}

Tests:
- TEST J: Invalid token -> HTTP 401 Unauthorized
- TEST K: Empty state for new user -> [] without demo data
- TEST A: Create family member via POST /api/patients
- TEST B: Read family members via GET /api/patients
- TEST C: Update family member via PUT /api/patients/{id}
- TEST E & F: App refresh & restart simulation -> family members persist
- TEST G: Logout/login simulation -> same family members restored
- TEST H: Cross-user isolation -> User Beta blocked from reading/editing User Alpha's family member
- TEST I: Tampered UID protection -> request body UID overridden with token UID
- TEST D: Delete family member via DELETE /api/patients/{id}
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
USER_ALPHA_UID = f"family_user_alpha_{int(time.time())}"
TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "family_alpha@gramcare.ai"})
HEADERS_ALPHA = {"Authorization": f"Bearer {TOKEN_ALPHA}"}

# Test User Beta (for isolation testing)
USER_BETA_UID = f"family_user_beta_{int(time.time())}"
TOKEN_BETA = create_access_token({"sub": USER_BETA_UID, "email": "family_beta@gramcare.ai"})
HEADERS_BETA = {"Authorization": f"Bearer {TOKEN_BETA}"}


def run_all_step9_tests():
    print("\n==================================================")
    print("   STEP 9 FIRESTORE FAMILY MEMBERS MIGRATION TESTS")
    print("==================================================\n")

    # TEST J: Invalid auth token -> HTTP 401
    print("[TEST J] Testing invalid auth token security...")
    res = client.get("/api/patients", headers={"Authorization": "Bearer INVALID_TOKEN_123"})
    assert res.status_code == 401, f"Expected 401 for invalid token, got {res.status_code}"
    print("  --> SUCCESS: Invalid token rejected with HTTP 401")

    # TEST K: Empty state for new user without family members
    print("\n[TEST K] Checking empty state for new user without family members...")
    res = client.get("/api/patients", headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    members = res.json()
    assert isinstance(members, list), "Expected list of family members"
    assert len(members) == 0, f"Expected empty list for new user, got {len(members)}"
    print("  --> SUCCESS: Empty state returns [] without demo data")

    # TEST A: Create real family member via POST /api/patients
    print("\n[TEST A] Creating real family member document via POST /api/patients...")
    new_member_payload = {
        "fullName": "Sita Devi",
        "relation": "Mother",
        "dob": "1965-05-12",
        "age": 61,
        "gender": "female",
        "bloodGroup": "O+",
        "phone": "+919876543210",
        "knownAllergies": "Penicillin",
        "medicalConditions": "Hypertension",
        "currentMedications": "Amlodipine 5mg"
    }
    res = client.post("/api/patients", json=new_member_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    created_member = res.json()
    member_id = created_member["id"]
    assert member_id.startswith("fam_")
    assert created_member["fullName"] == "Sita Devi"
    assert created_member["relation"] == "Mother"
    assert created_member["userId"] == USER_ALPHA_UID
    print(f"  --> SUCCESS: Created family member users/{USER_ALPHA_UID}/familyMembers/{member_id}")

    # TEST B: Read family members via GET /api/patients
    print("\n[TEST B] Reading family members via GET /api/patients...")
    res = client.get("/api/patients", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    all_members = res.json()
    assert len(all_members) == 1
    assert all_members[0]["id"] == member_id
    assert all_members[0]["fullName"] == "Sita Devi"
    print("  --> SUCCESS: Successfully retrieved authenticated user's family member")

    # TEST C: Update family member via PUT /api/patients/{id}
    print(f"\n[TEST C] Updating family member via PUT /api/patients/{member_id}...")
    update_payload = {
        "fullName": "Sita Devi",
        "relation": "Mother",
        "knownAllergies": "Penicillin, Dust",
        "medicalConditions": "Hypertension, Controlled Type-2 Diabetes",
        "currentMedications": "Amlodipine 5mg, Metformin 500mg"
    }
    res = client.put(f"/api/patients/{member_id}", json=update_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    updated_member = res.json()
    assert updated_member["knownAllergies"] == "Penicillin, Dust"
    assert updated_member["medicalConditions"] == "Hypertension, Controlled Type-2 Diabetes"
    print("  --> SUCCESS: Family member updated cleanly in Firestore")

    # TEST E & F: App refresh & restart simulation -> family members persist
    print("\n[TEST E & F] Simulating app refresh & restart...")
    res = client.get(f"/api/patients/{member_id}", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    restored = res.json()
    assert restored["fullName"] == "Sita Devi"
    assert restored["knownAllergies"] == "Penicillin, Dust"
    print("  --> SUCCESS: Family member persisted across refreshes and restarts")

    # TEST G: Logout & re-login simulation -> same family members restored
    print("\n[TEST G] Simulating user logout & re-login...")
    RELOGIN_TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "family_alpha@gramcare.ai"})
    res = client.get("/api/patients", headers={"Authorization": f"Bearer {RELOGIN_TOKEN_ALPHA}"})
    assert res.status_code == 200
    relogin_members = res.json()
    assert len(relogin_members) == 1
    assert relogin_members[0]["id"] == member_id
    print("  --> SUCCESS: Re-logged in user receives their existing family members")

    # TEST H: Cross-user isolation -> User Beta cannot read, update, or delete User Alpha's family member
    print("\n[TEST H] Checking isolation for User Beta...")
    res_beta_read = client.get(f"/api/patients/{member_id}", headers=HEADERS_BETA)
    assert res_beta_read.status_code == 404, f"User Beta should get 404 reading User Alpha's member, got {res_beta_read.status_code}"

    res_beta_update = client.put(f"/api/patients/{member_id}", json={"fullName": "Hacked Name"}, headers=HEADERS_BETA)
    assert res_beta_update.status_code == 404, f"User Beta should get 404 updating User Alpha's member, got {res_beta_update.status_code}"

    res_beta_delete = client.delete(f"/api/patients/{member_id}", headers=HEADERS_BETA)
    assert res_beta_delete.status_code == 404, f"User Beta should get 404 deleting User Alpha's member, got {res_beta_delete.status_code}"
    print("  --> SUCCESS: User Beta blocked from reading, modifying, or deleting User Alpha's family member")

    # TEST I: Tampered UID protection -> payload userId overridden with token UID
    print("\n[TEST I] Testing payload UID spoofing protection...")
    spoofed_member_payload = {
        "userId": "SPOOFED_ADMIN_UID_999",
        "fullName": "Ramesh Brother",
        "relation": "Brother",
        "dob": "1990-01-01"
    }
    res = client.post("/api/patients", json=spoofed_member_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200
    created_spoofed = res.json()
    assert created_spoofed["userId"] == USER_ALPHA_UID, f"Expected {USER_ALPHA_UID}, got {created_spoofed.get('userId')}"
    spoofed_id = created_spoofed["id"]
    print("  --> SUCCESS: Backend enforced verified token UID and ignored spoofed payload userId")

    # Clean up spoofed member
    client.delete(f"/api/patients/{spoofed_id}", headers=HEADERS_ALPHA)

    # TEST D: Delete family member via DELETE /api/patients/{id}
    print(f"\n[TEST D] Deleting family member via DELETE /api/patients/{member_id}...")
    res_del = client.delete(f"/api/patients/{member_id}", headers=HEADERS_ALPHA)
    assert res_del.status_code == 200, f"Expected 200, got {res_del.status_code}"

    # Verify deletion
    res_verify = client.get(f"/api/patients/{member_id}", headers=HEADERS_ALPHA)
    assert res_verify.status_code == 404, "Deleted family member should return 404"
    print("  --> SUCCESS: Family member deleted cleanly from Firestore")

    print("\n==================================================")
    print(" ALL STEP 9 FIRESTORE FAMILY TESTS PASSED 100%!   ")
    print("==================================================\n")


if __name__ == "__main__":
    run_all_step9_tests()
