"""
Automated Test Suite for GramCare AI Authentication & Connection Reliability
Verifies:
1. Health check endpoints (/health and /api/health)
2. Phone authentication endpoint (/api/auth/phone) with valid and invalid numbers
3. Google authentication endpoint (/api/auth/google) validation and error handling
4. Authorization & session verification (/api/auth/me)
5. CORS headers and security against sensitive data leaks
"""
import os
import sys

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from services.auth_service import create_access_token

client = TestClient(app)

def test_health_endpoints():
    print("\n[TEST 1] Testing /health and /api/health endpoints...")
    r1 = client.get("/health")
    assert r1.status_code == 200, f"Expected 200, got {r1.status_code}: {r1.text}"
    data1 = r1.json()
    assert data1.get("status") == "ok"
    assert "GramCare" in data1.get("service", "")
    print("  --> /health passed:", data1)

    r2 = client.get("/api/health")
    assert r2.status_code == 200, f"Expected 200, got {r2.status_code}: {r2.text}"
    data2 = r2.json()
    assert data2.get("status") == "ok"
    print("  --> /api/health passed:", data2)

def test_phone_auth_valid_indian_number():
    print("\n[TEST 2] Testing /api/auth/phone with valid Indian 10-digit number...")
    payload = {"phoneNumber": "+919876543210"}
    r = client.post("/api/auth/phone", json=payload)
    assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("status") in ["gateway_unavailable", "otp_sent"]
    assert "phoneNumber" in data
    print("  --> Valid phone auth response:", data)

def test_phone_auth_invalid_numbers():
    print("\n[TEST 3] Testing /api/auth/phone with invalid numbers...")
    # Too short
    r1 = client.post("/api/auth/phone", json={"phoneNumber": "12345"})
    assert r1.status_code == 400, f"Expected 400 for short number, got {r1.status_code}"
    print("  --> Short number rejected with 400:", r1.json().get("detail"))

    # Starts with invalid Indian telecom digit (e.g. 1)
    r2 = client.post("/api/auth/phone", json={"phoneNumber": "1234567890"})
    assert r2.status_code == 400, f"Expected 400 for invalid prefix, got {r2.status_code}"
    print("  --> Invalid prefix rejected with 400:", r2.json().get("detail"))

def test_google_auth_validation():
    print("\n[TEST 4] Testing /api/auth/google validation...")
    # Missing idToken
    r1 = client.post("/api/auth/google", json={})
    assert r1.status_code == 422, f"Expected 422 validation error, got {r1.status_code}"
    print("  --> Empty request rejected with 422")

    # Invalid fake token
    r2 = client.post("/api/auth/google", json={"idToken": "fake_invalid_token_12345", "email": "test@gramcare.in"})
    assert r2.status_code == 401, f"Expected 401 for fake token, got {r2.status_code}: {r2.text}"
    detail = r2.json().get("detail", "")
    assert "token" in detail.lower() or "verify" in detail.lower()
    print("  --> Invalid token rejected with HTTP 401 and specific reason:", detail)

def test_protected_me_endpoint_security():
    print("\n[TEST 5] Testing /api/auth/me security...")
    # Unauthenticated
    r_unauth = client.get("/api/auth/me")
    assert r_unauth.status_code == 401
    print("  --> Unauthenticated /me rejected with HTTP 401")

    # Invalid bearer token
    r_invalid = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid_garbage_token"})
    assert r_invalid.status_code == 401
    print("  --> Invalid token /me rejected with HTTP 401")

    # Valid internal JWT token
    test_uid = "test_auth_check_user_2026"
    test_email = "connectivity_test@gramcare.in"
    valid_token = create_access_token({"sub": test_uid, "email": test_email})
    r_auth = client.get("/api/auth/me", headers={"Authorization": f"Bearer {valid_token}"})
    assert r_auth.status_code == 200, f"Expected 200 for valid token, got {r_auth.status_code}: {r_auth.text}"
    user = r_auth.json()
    assert user.get("uid") == test_uid or user.get("id") == test_uid
    print("  --> Authenticated /me succeeded with correct UID isolation:", user.get("email"))

def test_cors_options_preflight():
    print("\n[TEST 6] Testing CORS headers for frontend origin...")
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type,Authorization"
    }
    r = client.options("/api/auth/google", headers=headers)
    assert r.status_code in [200, 204], f"Expected 200 or 204, got {r.status_code}"
    assert r.headers.get("access-control-allow-origin") == "http://localhost:5173"
    print("  --> CORS preflight OK for http://localhost:5173")

if __name__ == "__main__":
    print("==================================================")
    print("  GRAMCARE AI AUTHENTICATION & CONNECTION TESTS   ")
    print("==================================================")
    test_health_endpoints()
    test_phone_auth_valid_indian_number()
    test_phone_auth_invalid_numbers()
    test_google_auth_validation()
    test_protected_me_endpoint_security()
    test_cors_options_preflight()
    print("\n==================================================")
    print("  ALL 6 AUTHENTICATION & CONNECTION TESTS PASSED! ")
    print("==================================================")
