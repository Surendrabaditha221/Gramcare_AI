"""
Step 7 Verification Suite: Firestore Health Alerts & Notifications Migration
Tests end-to-end alert persistence under users/{uid}/alerts/{alertId}.
Validates strict Firebase token UID ownership, isolation, read/unread status persistence, and empty state.
"""
import sys
import os
import time
from fastapi.testclient import TestClient

# Ensure backend folder is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from services.auth_service import create_access_token

client = TestClient(app)

# Test User Alpha
USER_ALPHA_UID = f"alert_user_alpha_{int(time.time())}"
TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "alert_alpha@gramcare.ai"})
HEADERS_ALPHA = {"Authorization": f"Bearer {TOKEN_ALPHA}"}

# Test User Beta (for cross-user isolation tests)
USER_BETA_UID = f"alert_user_beta_{int(time.time())}"
TOKEN_BETA = create_access_token({"sub": USER_BETA_UID, "email": "alert_beta@gramcare.ai"})
HEADERS_BETA = {"Authorization": f"Bearer {TOKEN_BETA}"}


def run_all_step7_tests():
    print("\n==================================================")
    print("   STEP 7 FIRESTORE HEALTH ALERTS & NOTIFICATIONS  ")
    print("==================================================\n")

    # TEST J: Invalid auth token -> HTTP 401
    print("[TEST J] Testing invalid auth token security...")
    res = client.get("/api/alerts", headers={"Authorization": "Bearer INVALID_TOKEN_123"})
    assert res.status_code == 401, f"Expected 401 for invalid token, got {res.status_code}"
    print("  --> SUCCESS: Invalid token rejected with HTTP 401")

    # TEST K: Empty state (No alerts yet) -> Returns []
    print("\n[TEST K] Checking empty state for new user without alerts...")
    res = client.get("/api/alerts", headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    alerts_data = res.json()
    assert alerts_data == [], f"Expected empty list for new user, got: {alerts_data}"
    print("  --> SUCCESS: Returns empty list [] without demo data")

    # TEST A: Create real alert -> Firestore users/{uid}/alerts/{alertId}
    print("\n[TEST A] Creating real health alert via POST /api/alerts...")
    alert_payload = {
        "category": "health",
        "type": "reminders",
        "title": "Blood Pressure Monitoring Required",
        "teluguTitle": "రక్తపోటు తనిఖీ అవసరం",
        "message": "Daily BP measurement reminder scheduled for 09:00 AM.",
        "teluguMessage": "ఉదయం 09:00 గంటలకు రోజువారీ బిపి కొలత రిమైండర్ నిర్ణయించబడింది.",
        "severity": "medium",
        "isRead": False,
        "actionRoute": "/vitals"
    }
    res = client.post("/api/alerts", json=alert_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 201, f"Expected 201 Created, got {res.status_code}: {res.text}"
    created_alert = res.json()
    alert_id = created_alert["id"]
    assert created_alert["userId"] == USER_ALPHA_UID, f"Expected userId {USER_ALPHA_UID}, got {created_alert.get('userId')}"
    assert created_alert["title"] == "Blood Pressure Monitoring Required"
    assert created_alert["isRead"] is False
    print(f"  --> SUCCESS: Created alert users/{USER_ALPHA_UID}/alerts/{alert_id}")

    # TEST B: Read alerts -> Returns authenticated user's alerts only
    print("\n[TEST B] Reading alerts via GET /api/alerts...")
    res = client.get("/api/alerts", headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    alerts_list = res.json()
    assert len(alerts_list) == 1, f"Expected 1 alert, got {len(alerts_list)}"
    assert alerts_list[0]["id"] == alert_id
    assert alerts_list[0]["userId"] == USER_ALPHA_UID
    print("  --> SUCCESS: Returned authenticated user's alerts")

    # TEST C: Mark alert as read -> Persisted
    print("\n[TEST C] Marking alert as read via PUT /api/alerts/{alert_id}/read...")
    res = client.put(f"/api/alerts/{alert_id}/read?isRead=true", headers=HEADERS_ALPHA)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    updated_alert = res.json()
    assert updated_alert["isRead"] is True, f"Expected isRead=True, got {updated_alert.get('isRead')}"

    # Verify read status persisted on re-fetch
    res = client.get(f"/api/alerts/{alert_id}", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    assert res.json()["isRead"] is True
    print("  --> SUCCESS: Mark as read state persisted cleanly")

    # TEST E & F: Refresh & restart simulation
    print("\n[TEST E & F] Simulating app refresh & restart...")
    res = client.get("/api/alerts", headers=HEADERS_ALPHA)
    assert res.status_code == 200
    restored_list = res.json()
    assert len(restored_list) == 1
    assert restored_list[0]["id"] == alert_id
    assert restored_list[0]["isRead"] is True
    print("  --> SUCCESS: Alert and unread status persisted across app restarts")

    # TEST G: Logout / re-login simulation
    print("\n[TEST G] Simulating user logout & re-login...")
    RELOGIN_TOKEN_ALPHA = create_access_token({"sub": USER_ALPHA_UID, "email": "alert_alpha@gramcare.ai"})
    res = client.get("/api/alerts", headers={"Authorization": f"Bearer {RELOGIN_TOKEN_ALPHA}"})
    assert res.status_code == 200
    relogin_alerts = res.json()
    assert len(relogin_alerts) == 1
    assert relogin_alerts[0]["id"] == alert_id
    print("  --> SUCCESS: Re-logged in user sees their existing alerts")

    # TEST H: Isolation check -> User Beta cannot access User Alpha's alert
    print("\n[TEST H] Checking isolation for User Beta...")
    res = client.get(f"/api/alerts/{alert_id}", headers=HEADERS_BETA)
    assert res.status_code == 404, f"Expected 404 for unauthorized alert access, got {res.status_code}"

    res = client.put(f"/api/alerts/{alert_id}/read?isRead=false", headers=HEADERS_BETA)
    assert res.status_code == 404, f"Expected 404 for unauthorized alert update, got {res.status_code}"

    res = client.delete(f"/api/alerts/{alert_id}", headers=HEADERS_BETA)
    assert res.status_code == 404, f"Expected 404 for unauthorized alert delete, got {res.status_code}"
    print("  --> SUCCESS: User Beta blocked from reading, modifying, or deleting User Alpha's alert")

    # TEST I: Tampered payload UID protection
    print("\n[TEST I] Testing payload UID spoofing protection...")
    spoofed_payload = {
        "userId": "SPOOFED_ADMIN_UID_999",
        "category": "system",
        "title": "Spoofed Alert",
        "message": "Attempting to create alert for another user."
    }
    res = client.post("/api/alerts", json=spoofed_payload, headers=HEADERS_ALPHA)
    assert res.status_code == 201
    created_spoofed = res.json()
    assert created_spoofed["userId"] == USER_ALPHA_UID, f"Expected {USER_ALPHA_UID}, got {created_spoofed.get('userId')}"
    print("  --> SUCCESS: Backend enforced verified token UID and ignored spoofed payload userId")

    # Clean up spoofed alert
    client.delete(f"/api/alerts/{created_spoofed['id']}", headers=HEADERS_ALPHA)

    # TEST D: Delete alert -> Removed
    print("\n[TEST D] Deleting alert via DELETE /api/alerts/{alert_id}...")
    res = client.delete(f"/api/alerts/{alert_id}", headers=HEADERS_ALPHA)
    assert res.status_code == 204, f"Expected 204 No Content, got {res.status_code}"

    # Verify deleted alert is gone
    res = client.get("/api/alerts", headers=HEADERS_ALPHA)
    assert len(res.json()) == 0
    print("  --> SUCCESS: Alert deleted cleanly from Firestore")

    print("\n==================================================")
    print("  ALL STEP 7 FIRESTORE ALERT TESTS PASSED 100%!   ")
    print("==================================================\n")


if __name__ == "__main__":
    run_all_step7_tests()
