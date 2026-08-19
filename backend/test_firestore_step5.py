"""
Step 5 Automated Verification Test Suite for Firestore Chat Persistence
Collection Structure: users/{uid}/conversations/{conversationId}/messages/{messageId}

Tests:
- Test A: New conversation -> saved to Firestore
- Test B: User message -> saved to messages collection
- Test C: Assistant response -> saved to messages collection
- Test D: Refresh application simulation -> history preserved
- Test E: Close/reopen app simulation -> history preserved
- Test F: Logout/login -> same user's conversation history loads
- Test G: Different Google user -> cannot see user Alpha's conversations
- Test H: Invalid auth token -> returns 401 Unauthorized
- Test I: Another user's conversation ID -> access denied (403 Forbidden)
- Test J: No conversations -> returns empty state (no demo data)
"""
import sys
import os
import asyncio
from datetime import datetime

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from services import firestore_chat_service
from services.auth_service import create_access_token

def run_step5_tests():
    print("==================================================")
    print("      STEP 5 FIRESTORE CHAT MIGRATION TESTS       ")
    print("==================================================")

    client = TestClient(app)

    uid_alpha = f"user_alpha_{int(datetime.now().timestamp())}"
    uid_beta = f"user_beta_{int(datetime.now().timestamp())}"
    token_alpha = create_access_token({"sub": uid_alpha, "email": "alpha@example.com"})
    token_beta = create_access_token({"sub": uid_beta, "email": "beta@example.com"})

    headers_alpha = {"Authorization": f"Bearer {token_alpha}"}
    headers_beta = {"Authorization": f"Bearer {token_beta}"}

    # ----------------------------------------------------
    # TEST J: No conversations -> returns empty state (no demo data)
    # ----------------------------------------------------
    print("\n[TEST J] Checking empty conversation state for new user...")
    res_empty = client.get("/api/chat/conversations", headers=headers_alpha)
    assert res_empty.status_code == 200, f"Expected 200, got {res_empty.status_code}"
    convs_empty = res_empty.json()["conversations"]
    assert len(convs_empty) == 0, f"Expected 0 conversations, got {len(convs_empty)}"
    print("  --> SUCCESS: Returns empty conversation list [] without demo data")

    # ----------------------------------------------------
    # TEST A: New conversation -> saved to Firestore
    # ----------------------------------------------------
    print("\n[TEST A] Creating new conversation in Firestore...")
    conv_a = asyncio.run(firestore_chat_service.create_conversation(uid_alpha, {
        "title": "Diabetes Care Consultation",
        "patientName": "Primary User"
    }))
    assert conv_a is not None, "Failed to create conversation"
    conv_id = conv_a["id"]
    print(f"  --> SUCCESS: Conversation users/{uid_alpha}/conversations/{conv_id} created")

    # ----------------------------------------------------
    # TEST B & C: User message & Assistant response saved
    # ----------------------------------------------------
    print("\n[TEST B & C] Saving user message and assistant response...")
    msg_user = asyncio.run(firestore_chat_service.save_message(uid_alpha, conv_id, {
        "role": "user",
        "content": "What symptoms indicate high blood sugar?"
    }))
    assert msg_user["role"] == "user", "User role mismatch"

    msg_asst = asyncio.run(firestore_chat_service.save_message(uid_alpha, conv_id, {
        "role": "assistant",
        "content": "High blood sugar (hyperglycemia) symptoms include increased thirst, frequent urination, and fatigue."
    }))
    assert msg_asst["role"] == "assistant", "Assistant role mismatch"
    print("  --> SUCCESS: User message and assistant response saved to messages collection")

    # ----------------------------------------------------
    # TEST D & E: Refresh / App Restart simulation -> history preserved
    # ----------------------------------------------------
    print("\n[TEST D & E] Fetching chat history after app refresh/restart simulation...")
    res_hist = client.get(f"/api/chat/conversations/{conv_id}/messages", headers=headers_alpha)
    assert res_hist.status_code == 200, f"Expected 200, got {res_hist.status_code}"
    msgs = res_hist.json()["messages"]
    assert len(msgs) == 2, f"Expected 2 messages, got {len(msgs)}"
    assert msgs[0]["content"] == "What symptoms indicate high blood sugar?"
    print("  --> SUCCESS: Chat history preserved cleanly across refresh/restart")

    # ----------------------------------------------------
    # TEST F: Logout/login -> same user's conversation history loads
    # ----------------------------------------------------
    print("\n[TEST F] User re-login session history check...")
    new_token_alpha = create_access_token({"sub": uid_alpha, "email": "alpha@example.com"})
    res_relogin = client.get("/api/chat/conversations", headers={"Authorization": f"Bearer {new_token_alpha}"})
    assert res_relogin.status_code == 200
    user_convs = res_relogin.json()["conversations"]
    assert len(user_convs) == 1
    assert user_convs[0]["id"] == conv_id
    print("  --> SUCCESS: Re-logged in user sees their existing conversation thread")

    # ----------------------------------------------------
    # TEST G: Different Google user (Beta) -> cannot see Alpha's conversations
    # ----------------------------------------------------
    print("\n[TEST G] Checking isolation for User Beta...")
    res_beta_convs = client.get("/api/chat/conversations", headers=headers_beta)
    assert res_beta_convs.status_code == 200
    beta_convs = res_beta_convs.json()["conversations"]
    assert len(beta_convs) == 0, f"User Beta saw User Alpha's conversations!"
    print("  --> SUCCESS: User Beta sees only their own empty conversation list")

    # ----------------------------------------------------
    # TEST H: Invalid auth token -> 401 Unauthorized
    # ----------------------------------------------------
    print("\n[TEST H] Invalid token security test...")
    res_invalid = client.get("/api/chat/conversations", headers={"Authorization": "Bearer invalid.token.payload"})
    assert res_invalid.status_code == 401, f"Expected 401, got {res_invalid.status_code}"
    print("  --> SUCCESS: Invalid token rejected with HTTP 401")

    # ----------------------------------------------------
    # TEST I: User Beta attempting to access User Alpha's conversation ID -> 403 Access Denied
    # ----------------------------------------------------
    print("\n[TEST I] Cross-user conversation ID tamper attack test...")
    res_tamper = client.get(f"/api/chat/conversations/{conv_id}/messages", headers=headers_beta)
    assert res_tamper.status_code == 403, f"Expected 403 Forbidden, got {res_tamper.status_code}"
    print(f"  --> SUCCESS: Cross-user access blocked with HTTP 403 ({res_tamper.json().get('detail')})")

    print("\n==================================================")
    print(" ALL STEP 5 FIRESTORE CHAT TESTS PASSED 100%!     ")
    print("==================================================")
    return True

if __name__ == "__main__":
    success = run_step5_tests()
    if not success:
        sys.exit(1)
