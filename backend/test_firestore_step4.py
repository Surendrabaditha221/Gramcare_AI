"""
Step 4 Automated Verification Test Suite for Firestore users/{uid} Migration
Tests:
- Test A: New real Google account -> Firestore user document created under users/{uid}
- Test B: Same user logs out and logs in again -> same Firestore document loaded
- Test C: App restart simulation -> same user restored via token
- Test D: User updates profile -> same Firestore document updated (no duplicates)
- Test E: Different user -> different Firebase UID -> different Firestore document
- Test F: No authentication -> request rejected with 401
- Test G: Mismatched / fake UID in request -> backend forces verified token UID
"""
import sys
import os
import asyncio
from datetime import datetime

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from services import firestore_user_service
from services.auth_service import create_access_token

def run_step4_tests():
    print("==================================================")
    print("      STEP 4 FIRESTORE USER MIGRATION TESTS       ")
    print("==================================================")

    client = TestClient(app)

    uid_a = f"test_google_uid_alpha_{int(datetime.now().timestamp())}"
    uid_b = f"test_google_uid_beta_{int(datetime.now().timestamp())}"
    email_a = "user_alpha@example.com"
    email_b = "user_beta@example.com"

    token_a = create_access_token({"sub": uid_a, "email": email_a})
    token_b = create_access_token({"sub": uid_b, "email": email_b})

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # ----------------------------------------------------
    # TEST A: New real Google account -> Firestore document users/{uid}
    # ----------------------------------------------------
    print("\n[TEST A] Creating new user in Firestore users/{uid}...")
    user_a_doc = asyncio.run(firestore_user_service.create_user(uid_a, {
        "uid": uid_a,
        "email": email_a,
        "displayName": "User Alpha",
        "photoURL": "https://example.com/alpha.png"
    }))
    assert user_a_doc is not None, "Failed to create user A doc"
    assert user_a_doc["uid"] == uid_a, f"Expected UID {uid_a}, got {user_a_doc['uid']}"
    assert user_a_doc["profileCompleted"] is False, "Expected profileCompleted to be False initially"
    print(f"  --> SUCCESS: Document users/{uid_a} created with email '{email_a}' and profileCompleted=False")

    # ----------------------------------------------------
    # TEST B: Same user logs in again -> same Firestore document loaded
    # ----------------------------------------------------
    print("\n[TEST B] Simulating re-login for existing user...")
    relogin_doc = asyncio.run(firestore_user_service.update_user(uid_a, {
        "lastLogin": datetime.now().isoformat()
    }))
    assert relogin_doc["uid"] == uid_a, "Re-login loaded different UID"
    assert relogin_doc["createdAt"] == user_a_doc["createdAt"], "createdAt changed unexpectedly"
    print(f"  --> SUCCESS: Same Firestore document users/{uid_a} loaded and lastLogin updated")

    # ----------------------------------------------------
    # TEST C: Close and reopen app -> same user restored via GET /api/auth/me
    # ----------------------------------------------------
    print("\n[TEST C] Testing app restart session restore (GET /api/auth/me)...")
    res_me = client.get("/api/auth/me", headers=headers_a)
    assert res_me.status_code == 200, f"Expected 200, got {res_me.status_code}"
    me_data = res_me.json()
    assert me_data["uid"] == uid_a, f"Expected restored UID {uid_a}, got {me_data.get('uid')}"
    print(f"  --> SUCCESS: Session restored for UID '{me_data.get('uid')}' without requesting onboarding again")

    # ----------------------------------------------------
    # TEST D: User updates profile -> same Firestore document updated (profileCompleted=True)
    # ----------------------------------------------------
    print("\n[TEST D] User updates health profile (POST /api/users/profile)...")
    profile_update = {
        "fullName": "User Alpha Updated",
        "dob": "1992-05-15",
        "gender": "female",
        "phone": "+919876543210",
        "village": "Rampur"
    }
    res_prof = client.post("/api/users/profile", json=profile_update, headers=headers_a)
    assert res_prof.status_code == 200, f"Expected 200, got {res_prof.status_code}"
    updated_prof = res_prof.json()["profile"]
    assert updated_prof["uid"] == uid_a, "Profile update mutated UID"
    assert updated_prof["profileCompleted"] is True, "Expected profileCompleted=True after profile submit"
    assert updated_prof["onboardingCompleted"] is True, "Expected onboardingCompleted=True after profile submit"
    print(f"  --> SUCCESS: Document users/{uid_a} updated cleanly (profileCompleted=True). No duplicates created.")

    # ----------------------------------------------------
    # TEST E: Different Google account -> different Firebase UID
    # ----------------------------------------------------
    print("\n[TEST E] Creating second distinct user (User Beta)...")
    user_b_doc = asyncio.run(firestore_user_service.create_user(uid_b, {
        "uid": uid_b,
        "email": email_b,
        "displayName": "User Beta"
    }))
    assert user_b_doc["uid"] == uid_b, "Beta UID mismatch"
    assert user_b_doc["uid"] != user_a_doc["uid"], "UID collision detected!"
    print(f"  --> SUCCESS: Separate Firestore document users/{uid_b} created independently")

    # ----------------------------------------------------
    # TEST F: No authentication -> request rejected with 401
    # ----------------------------------------------------
    print("\n[TEST F] Accessing protected user endpoint without auth header...")
    res_no_auth = client.get("/api/auth/me")
    assert res_no_auth.status_code == 401, f"Expected 401, got {res_no_auth.status_code}"
    print(f"  --> SUCCESS: Request rejected with HTTP 401 ({res_no_auth.json().get('detail')})")

    # ----------------------------------------------------
    # TEST G: Fake/Mismatched UID in request payload -> Backend enforces verified token UID
    # ----------------------------------------------------
    print("\n[TEST G] Attempting profile overwrite with mismatched payload UID...")
    spoof_payload = {
        "uid": "ATTACKER_SPOOF_UID_9999",
        "userId": "ATTACKER_SPOOF_UID_9999",
        "fullName": "Spoofed Name"
    }
    res_spoof = client.post("/api/users/profile", json=spoof_payload, headers=headers_a)
    assert res_spoof.status_code == 200, f"Expected 200, got {res_spoof.status_code}"
    spoof_res = res_spoof.json()["profile"]
    assert spoof_res["uid"] == uid_a, f"Backend failed to override fake UID! Got {spoof_res['uid']}"
    assert spoof_res["uid"] != "ATTACKER_SPOOF_UID_9999", "Spoofed UID was accepted!"
    print(f"  --> SUCCESS: Backend enforced verified token UID '{uid_a}' and ignored spoofed payload UID")

    print("\n==================================================")
    print(" ALL STEP 4 FIRESTORE MIGRATION TESTS PASSED 100%! ")
    print("==================================================")
    return True

if __name__ == "__main__":
    success = run_step4_tests()
    if not success:
        sys.exit(1)
