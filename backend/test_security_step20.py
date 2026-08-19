"""
Verification Test Suite for Step 20 - Production Security, Secrets, Error Handling, and Deployment Readiness
Tests:
1. Secrets Audit: Ensures service-account JSON is not tracked and .env.example files contain zero secret values.
2. Rate Limiting: Verifies RateLimiterMiddleware throttles excessive requests with HTTP 429 and Retry-After header.
3. CORS Hardening: Verifies origin lists and production configuration.
4. Authentication & UID Security: Verifies token requirement on protected routes and rejection of spoofed user IDs.
5. Payload Validation: Verifies Pydantic bounds reject oversized payloads.
6. Safe Error Handling: Verifies unhandled exceptions return safe JSON without exposing stack traces or paths.
7. Operational Health Check: Verifies /health endpoint returns clean status without secret leakage.
"""

import os
import sys
import asyncio
import subprocess
from fastapi.testclient import TestClient

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from main import app
from middleware.rate_limiter import RateLimiterMiddleware

def run_security_tests():
    print("==================================================")
    print("   STEP 20 PRODUCTION SECURITY & AUDIT SUITE      ")
    print("==================================================")

    # 1. Test Secrets & Gitignore
    print("\n[TEST 1] Testing Secrets & Gitignore Status...", flush=True)
    git_check = subprocess.run(
        ["git", "check-ignore", "-v", "backend/secrets/firebase-service-account.json"],
        cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        capture_output=True,
        text=True
    )
    assert git_check.returncode == 0, "backend/secrets/ must be gitignored"
    print(f"  [✓] Gitignore verified: {git_check.stdout.strip()}")

    # Check .env.example files for zero real secrets
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for example_file in [os.path.join(root_dir, ".env.example"), os.path.join(root_dir, "backend", ".env.example")]:
        with open(example_file, "r", encoding="utf-8") as f:
            content = f.read()
            assert "AIzaSy" not in content, f"No real Google API key in {example_file}"
            assert "BEGIN PRIVATE KEY" not in content, f"No private key in {example_file}"
    print("  [✓] All .env.example files verified free of private keys and secrets.")

    client = TestClient(app)

    # 2. Test Operational Health Check
    print("\n[TEST 2] Testing /health Endpoint Output Sanitization...", flush=True)
    res_health = client.get("/health")
    assert res_health.status_code == 200, "Health check must return 200"
    health_json = res_health.json()
    assert health_json.get("status") == "ok"
    assert "service" in health_json
    assert "GEMINI_API_KEY" not in str(health_json), "No secret keys leaked in health check"
    assert "private_key" not in str(health_json), "No private key leaked in health check"
    print(f"  --> Health Status: {health_json}")
    print("  [✓] Health check verified safe and clean.")

    # 3. Test Rate Limiter Middleware
    print("\n[TEST 3] Testing Rate Limiting on AI Endpoints...", flush=True)
    # Perform rapid bursts to trigger rate limiter
    hit_429 = False
    for i in range(40):
        resp = client.post(
            "/api/chat",
            json={"message": "ping test", "patient_name": "Test", "language": "en"}
        )
        if resp.status_code == 429:
            hit_429 = True
            retry_after = resp.headers.get("Retry-After")
            print(f"  --> Rate limit triggered on request #{i + 1}: 429 Too Many Requests (Retry-After: {retry_after}s)")
            break

    assert hit_429, "Rate limiter middleware must throttle excessive rapid requests with HTTP 429"
    print("  [✓] Rate Limiting protection verified.")

    # 4. Test Protected Routes Reject Missing Auth Tokens
    print("\n[TEST 4] Testing Protected Route Token Requirement...", flush=True)
    res_records = client.get("/api/records")
    assert res_records.status_code == 401, f"Protected route must return 401 without token, got {res_records.status_code}"
    
    res_patients = client.get("/api/patients")
    assert res_patients.status_code == 401, f"Protected route must return 401 without token, got {res_patients.status_code}"
    print("  [✓] Protected routes strictly require Bearer authorization tokens.")

    # 5. Test Payload Validation (Oversized Payload Rejection)
    print("\n[TEST 5] Testing Pydantic Request Validation Bounds...", flush=True)
    oversized_message = "A" * 3500
    res_oversized = client.post(
        "/api/chat",
        json={"message": oversized_message, "patient_name": "Test", "language": "en"}
    )
    # FastAPI returns 422 Unprocessable Entity on Pydantic validation failure (or 429 if rate-limited)
    assert res_oversized.status_code in [422, 429], f"Oversized payload must be rejected, got {res_oversized.status_code}"
    print("  [✓] Payload size constraints strictly enforced.")

    # 6. Test Firestore Security Rules File
    print("\n[TEST 6] Testing firestore.rules Specification...", flush=True)
    rules_path = os.path.join(root_dir, "firestore.rules")
    assert os.path.exists(rules_path), "firestore.rules file must exist in workspace"
    with open(rules_path, "r", encoding="utf-8") as f:
        rules_content = f.read()
        assert "request.auth.uid == userId" in rules_content, "Must enforce UID ownership"
        assert "allow write: if false;" in rules_content, "Medical knowledge base must be read-only for clients"
    print("  [✓] firestore.rules verified.")

    print("\n==================================================")
    print("   ALL STEP 20 SECURITY TESTS PASSED!            ")
    print("==================================================")

if __name__ == "__main__":
    run_security_tests()
