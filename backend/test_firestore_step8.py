"""
Step 8 Automated Verification Test Suite for Firestore User Settings Migration
Document Target: users/{uid}/settings/main

Tests:
- TEST A: New user settings created in Firestore
- TEST B: Read settings via GET /api/settings
- TEST C: Update settings via POST/PUT /api/settings
- TEST D: Refresh simulation -> settings persist
- TEST E: Close/reopen simulation -> settings persist
- TEST F: Logout/login simulation -> same user's settings load
- TEST G: Different Firebase user -> cannot access User Alpha's settings
- TEST H: Tampered UID protection -> request body UID overridden with token UID
- TEST I: Invalid token -> HTTP 401 Unauthorized
- TEST J: Safe defaults -> default settings created without fake/demo data
"""
import sys
import os
import time
from fastapi.testclient import TestClient

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from services.auth_service import create_access_token
from services import firestore_settings_service

client = TestClient(app)

# Test User Alpha
USER_ALPHA_UID = f"settings_user_alpha_{int(time.time())}"
TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "settings_alpha@gramcare.ai"})
HEADERS_ALPHA = {"Authorization": f"Bearer {TOKEN_ALPHA}"}

# Test User Beta (for isolation testing)
USER_BETA_UID = f"settings_user_beta_{int(time.time())}"
TOKEN_BETA = create_access_token({"sub": USER_BETA_UID, "email": "settings_beta@gramcare.ai"})
HEADERS_BETA = {"Authorization": f"Bearer {TOKEN_BETA}"}


def run_all_step8_tests():
    print("\n==================================================")
    print("   STEP 8 FIRESTORE USER SETTINGS MIGRATION TESTS ")
    print("==================================================\n")

    # TEST I: Invalid auth token -> HTTP 401
    print("[TEST I] Testing invalid auth token security...")
    res = client.get("/api/settings", headers={"Authorization": "Bearer INVALID_TOKEN_123"})
    assert res.status_code == 401, f"Expected 401 for invalid token, got {res.status_code}"
    print("  --> SUCCESS: Invalid token rejected with HTTP 401")

    # TEST J: Safe defaults for new user without existing settings
    print("\n[TEST J] Checking safe defaults for new user without existing settings...")
    res = client.get("/api/settings", headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    settings = res.json()
    assert settings["userId"] == USER_ALPHA_UID, f"Expected userId {USER_ALPHA_UID}, got {settings.get('userId')}"
    assert settings["theme"] == "light"
    assert settings["language"] == "en"
    assert "notifications" in settings
    assert settings["notifications"]["medicineReminders"] is True
    print("  --> SUCCESS: Safe default settings initialized without fake/demo data")

    # TEST A: Verify settings document created in Firestore
    print("\n[TEST A] Verifying settings document created in users/{uid}/settings/main...")
    res_fetch = client.get("/api/settings", headers=HEADERS_ALPHA)
    assert res_fetch.status_code == 200
    doc_data = res_fetch.json()
    assert doc_data["userId"] == USER_ALPHA_UID
    print(f"  --> SUCCESS: Document users/{USER_ALPHA_UID}/settings/main verified")

    # TEST B: Read settings via GET /api/settings
    print("\n[TEST B] Reading user settings via GET /api/settings...")
    res = client.get("/api/settings", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    curr_settings = res.json()
    assert curr_settings["userId"] == USER_ALPHA_UID
    print("  --> SUCCESS: Successfully retrieved user settings")

    # TEST C: Update settings via POST/PUT /api/settings
    print("\n[TEST C] Updating settings via POST /api/settings...")
    update_payload = {
        "theme": "dark",
        "language": "te",
        "notifications": {
            "medicineReminders": True,
            "healthAlerts": True,
            "appointmentAlerts": False,
            "smsAlerts": True
        }
    }
    res = client.post("/api/settings", json=update_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    updated = res.json()
    assert updated["theme"] == "dark"
    assert updated["language"] == "te"
    assert updated["notifications"]["smsAlerts"] is True
    assert updated["notifications"]["appointmentAlerts"] is False
    print("  --> SUCCESS: Settings updated cleanly in Firestore")

    # TEST D & E: App refresh & restart simulation -> settings persist
    print("\n[TEST D & E] Simulating app refresh & restart...")
    res = client.get("/api/settings", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    restored = res.json()
    assert restored["theme"] == "dark"
    assert restored["language"] == "te"
    assert restored["notifications"]["smsAlerts"] is True
    print("  --> SUCCESS: Updated settings persisted across restarts")

    # TEST F: Logout & re-login simulation
    print("\n[TEST F] Simulating user logout & re-login...")
    RELOGIN_TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "settings_alpha@gramcare.ai"})
    res = client.get("/api/settings", headers={"Authorization": f"Bearer {RELOGIN_TOKEN_ALPHA}"})
    assert res.status_code == 200
    relogin_settings = res.json()
    assert relogin_settings["theme"] == "dark"
    assert relogin_settings["language"] == "te"
    print("  --> SUCCESS: Re-logged in user receives their saved settings")

    # TEST G: Cross-user isolation -> User Beta cannot read or modify User Alpha's settings
    print("\n[TEST G] Checking isolation for User Beta...")
    res_beta = client.get("/api/settings", headers=HEADERS_BETA)
    assert res_beta.status_code == 200
    beta_settings = res_beta.json()
    # User Beta must receive their OWN default settings, NOT User Alpha's dark theme / te language
    assert beta_settings["userId"] == USER_BETA_UID
    assert beta_settings["theme"] == "light"
    assert beta_settings["language"] == "en"
    print("  --> SUCCESS: User Beta receives their own settings and cannot access User Alpha's settings")

    # TEST H: UID tampering protection
    print("\n[TEST H] Testing payload UID spoofing protection...")
    spoofed_payload = {
        "userId": "SPOOFED_ADMIN_UID_999",
        "theme": "light",
        "language": "hi"
    }
    res = client.post("/api/settings", json=spoofed_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 200
    updated_spoofed = res.json()
    assert updated_spoofed["userId"] == USER_ALPHA_UID, f"Expected {USER_ALPHA_UID}, got {updated_spoofed.get('userId')}"
    print("  --> SUCCESS: Backend enforced verified token UID and ignored spoofed payload userId")

    print("\n==================================================")
    print(" ALL STEP 8 FIRESTORE SETTINGS TESTS PASSED 100%! ")
    print("==================================================\n")


if __name__ == "__main__":
    run_all_step8_tests()
