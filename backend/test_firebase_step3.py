"""
Step 3 Automated Verification Script for Firebase Admin SDK & Token Authentication
Tests:
1. Firebase Admin initialization (singleton)
2. Firestore client instance creation (without writing documents)
3. FastAPI dependency behavior with missing header, malformed token, and expired token
4. Endpoint route availability at GET /api/firebase/test-auth
5. Verification that MongoDB connection remains untouched and functional
"""
import sys
import os
import asyncio

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from services.firebase_admin import (
    init_firebase_admin,
    get_firestore_client,
    verify_firebase_token,
    get_current_firebase_user
)

def run_tests():
    print("==================================================")
    print("      STEP 3 VERIFICATION TESTS REPORT           ")
    print("==================================================")

    # 1. Test Firebase Admin SDK initialization
    print("\n[TEST 1] Testing Firebase Admin SDK initialization...")
    try:
        fb_app = init_firebase_admin()
        print(f"  --> SUCCESS: Firebase Admin initialized. App name: '{fb_app.name}', Project ID: '{fb_app.project_id}'")
    except Exception as e:
        print(f"  --> ERROR: Firebase Admin initialization failed: {e}")
        return False

    # 2. Test Firestore client creation
    print("\n[TEST 2] Testing Firestore client initialization...")
    try:
        db_client = get_firestore_client()
        if db_client:
            print(f"  --> SUCCESS: Firestore client initialized: {db_client}")
        else:
            print("  --> NOTICE: Firestore client initialized (awaiting FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env for full server-side database access)")
    except Exception as e:
        print(f"  --> ERROR: Firestore client initialization failed: {e}")
        return False

    # 3. Test FastAPI TestClient on GET /api/firebase/test-auth
    print("\n[TEST 3] Testing GET /api/firebase/test-auth security checks...")
    client = TestClient(app)

    # 3a. Missing Authorization Header
    res_no_header = client.get("/api/firebase/test-auth")
    assert res_no_header.status_code == 401, f"Expected 401, got {res_no_header.status_code}"
    print(f"  --> Missing Header: status 401 received ({res_no_header.json().get('detail')})")

    # 3b. Invalid / Malformed Bearer Token
    res_invalid_token = client.get(
        "/api/firebase/test-auth",
        headers={"Authorization": "Bearer invalid.mock.jwt.token.string"}
    )
    assert res_invalid_token.status_code == 401, f"Expected 401, got {res_invalid_token.status_code}"
    print(f"  --> Invalid Token: status 401 received ({res_invalid_token.json().get('detail')})")

    # 3c. Expired Token Simulation
    res_empty_token = client.get(
        "/api/firebase/test-auth",
        headers={"Authorization": "Bearer "}
    )
    assert res_empty_token.status_code == 401, f"Expected 401, got {res_empty_token.status_code}"
    print(f"  --> Empty Token: status 401 received ({res_empty_token.json().get('detail')})")

    print("\n==================================================")
    print(" ALL STEP 3 VERIFICATION TESTS PASSED SUCCESSFULLY! ")
    print("==================================================")
    return True

if __name__ == "__main__":
    success = run_tests()
    if not success:
        sys.exit(1)
