"""
Automated Verification Test Suite for Delete Chat & Conversation Management
Tests:
- Test 1: Create multiple conversations for User Alpha -> both saved in Firestore
- Test 2: Add messages to both conversations -> messages saved in subcollections
- Test 3: Delete Conversation A -> Conversation A and its messages are permanently removed
- Test 4: Conversation B remains completely untouched with all its messages
- Test 5: Refresh simulation -> Conversation A remains deleted, Conversation B remains intact
- Test 6: Rename Conversation B -> Conversation B title updated successfully
- Test 7: User Beta cannot delete User Alpha's conversation (HTTP 403 Cross-user protection)
- Test 8: Unauthenticated deletion attempt -> rejected with HTTP 401 Unauthorized
- Test 9: Data Protection -> User Alpha's medical records and profile remain 100% untouched
- Test 10: Clear default conversation -> clears conv_default cleanly
"""
import sys
import os
import asyncio
from datetime import datetime

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from main import app
from services import firestore_chat_service, firestore_user_service, firestore_record_service
from services.auth_service import create_access_token

def run_delete_chat_tests():
    print("==================================================")
    print("    GRAMCARE AI DELETE CHAT & CONVERSATION TESTS  ")
    print("==================================================")

    client = TestClient(app)

    uid_alpha = f"del_user_alpha_{int(datetime.now().timestamp())}"
    uid_beta = f"del_user_beta_{int(datetime.now().timestamp())}"

    token_alpha = create_access_token({"sub": uid_alpha, "email": "alpha_del@example.com"})
    token_beta = create_access_token({"sub": uid_beta, "email": "beta_del@example.com"})

    headers_alpha = {"Authorization": f"Bearer {token_alpha}"}
    headers_beta = {"Authorization": f"Bearer {token_beta}"}

    # Setup User Alpha profile and medical records to verify Data Protection
    asyncio.run(firestore_user_service.create_user(uid_alpha, {
        "uid": uid_alpha,
        "email": "alpha_del@example.com",
        "displayName": "Alpha Patient",
        "age": 35,
        "gender": "Male"
    }))

    rec_data = asyncio.run(firestore_record_service.create_medical_record(uid_alpha, {
        "title": "Blood Pressure Record",
        "recordType": "Vitals",
        "patientName": "Alpha Patient"
    }))
    rec_id = rec_data["id"]

    # ----------------------------------------------------
    # TEST 8: Unauthenticated deletion attempt -> 401
    # ----------------------------------------------------
    print("\n[TEST 8] Security check: Unauthenticated deletion rejected with 401...")
    res_unauth = client.delete("/api/chat/conversations/conv_fake_123")
    assert res_unauth.status_code == 401, f"Expected 401, got {res_unauth.status_code}"
    print("  --> SUCCESS: Unauthenticated delete request rejected with HTTP 401")

    # ----------------------------------------------------
    # TEST 1 & 2: Create Conversation 1 and Conversation 2 with messages
    # ----------------------------------------------------
    print("\n[TEST 1 & 2] Creating Conversation 1 and Conversation 2 for User Alpha...")
    res_conv1 = client.post("/api/chat/conversations", json={
        "title": "High Fever Consultation",
        "patientName": "Alpha Patient"
    }, headers=headers_alpha)
    assert res_conv1.status_code == 200, f"Failed to create conv 1: {res_conv1.text}"
    conv1_id = res_conv1.json()["conversation"]["id"]

    res_conv2 = client.post("/api/chat/conversations", json={
        "title": "Knee Pain Guidance",
        "patientName": "Alpha Patient"
    }, headers=headers_alpha)
    assert res_conv2.status_code == 200, f"Failed to create conv 2: {res_conv2.text}"
    conv2_id = res_conv2.json()["conversation"]["id"]

    # Save messages to both
    asyncio.run(firestore_chat_service.save_message(uid_alpha, conv1_id, {
        "role": "user",
        "content": "I have high fever and shivering since yesterday"
    }))
    asyncio.run(firestore_chat_service.save_message(uid_alpha, conv1_id, {
        "role": "assistant",
        "content": "Drink plenty of water and rest. Visit your nearest PHC if fever persists."
    }))

    asyncio.run(firestore_chat_service.save_message(uid_alpha, conv2_id, {
        "role": "user",
        "content": "My knee hurts when I walk upstairs"
    }))
    asyncio.run(firestore_chat_service.save_message(uid_alpha, conv2_id, {
        "role": "assistant",
        "content": "Apply cold compression and avoid strenuous knee strain."
    }))

    # Verify both conversations and messages exist
    convs_list = client.get("/api/chat/conversations", headers=headers_alpha).json()["conversations"]
    assert len(convs_list) == 2, f"Expected 2 conversations, got {len(convs_list)}"
    msgs1 = client.get(f"/api/chat/conversations/{conv1_id}/messages", headers=headers_alpha).json()["messages"]
    msgs2 = client.get(f"/api/chat/conversations/{conv2_id}/messages", headers=headers_alpha).json()["messages"]
    assert len(msgs1) == 2, f"Expected 2 messages in conv1, got {len(msgs1)}"
    assert len(msgs2) == 2, f"Expected 2 messages in conv2, got {len(msgs2)}"
    print(f"  --> SUCCESS: Created conv1 ({conv1_id}) and conv2 ({conv2_id}) with messages")

    # ----------------------------------------------------
    # TEST 7: Cross-user delete protection -> User Beta cannot delete User Alpha's conv1
    # ----------------------------------------------------
    print("\n[TEST 7] Security check: User Beta attempting to delete User Alpha's conversation...")
    res_tamper_delete = client.delete(f"/api/chat/conversations/{conv1_id}", headers=headers_beta)
    assert res_tamper_delete.status_code == 403, f"Expected 403 Forbidden, got {res_tamper_delete.status_code}"
    # Verify conv1 still exists for Alpha
    msgs1_check = client.get(f"/api/chat/conversations/{conv1_id}/messages", headers=headers_alpha).json()["messages"]
    assert len(msgs1_check) == 2, "Conversation 1 was deleted by unauthorized user!"
    print("  --> SUCCESS: Cross-user deletion blocked with HTTP 403. Conversation preserved.")

    # ----------------------------------------------------
    # TEST 3: Delete Conversation 1 by authorized User Alpha
    # ----------------------------------------------------
    print("\n[TEST 3] User Alpha deleting Conversation 1...")
    res_del = client.delete(f"/api/chat/conversations/{conv1_id}", headers=headers_alpha)
    assert res_del.status_code == 200, f"Expected 200 OK, got {res_del.status_code}"
    del_json = res_del.json()
    assert del_json["success"] is True, f"Expected success: True, got {del_json}"
    print(f"  --> SUCCESS: Deleted conversation {conv1_id}")

    # Verify Conversation 1 is gone
    res_get_deleted = client.get(f"/api/chat/conversations/{conv1_id}/messages", headers=headers_alpha)
    assert res_get_deleted.status_code == 403 or res_get_deleted.status_code == 404, \
        f"Expected access denied/not found for deleted conv, got {res_get_deleted.status_code}"
    print("  --> SUCCESS: Conversation 1 cannot be accessed anymore")

    # ----------------------------------------------------
    # TEST 4: Conversation 2 remains completely untouched
    # ----------------------------------------------------
    print("\n[TEST 4] Verifying Conversation 2 and its messages remain intact...")
    convs_after = client.get("/api/chat/conversations", headers=headers_alpha).json()["conversations"]
    assert len(convs_after) == 1, f"Expected exactly 1 conversation remaining, got {len(convs_after)}"
    assert convs_after[0]["id"] == conv2_id, f"Expected conv2_id, got {convs_after[0]['id']}"
    msgs2_after = client.get(f"/api/chat/conversations/{conv2_id}/messages", headers=headers_alpha).json()["messages"]
    assert len(msgs2_after) == 2, f"Expected 2 messages in conv2, got {len(msgs2_after)}"
    print(f"  --> SUCCESS: Conversation 2 ({conv2_id}) is completely intact with all {len(msgs2_after)} messages")

    # ----------------------------------------------------
    # TEST 5: App refresh simulation -> Conversation 1 remains deleted
    # ----------------------------------------------------
    print("\n[TEST 5] Refresh app simulation -> Verifying persistent deletion...")
    # Simulate client page reload by fetching conversations with a fresh token
    new_token_alpha = create_access_token({"sub": uid_alpha, "email": "alpha_del@example.com"})
    refreshed_convs = client.get("/api/chat/conversations", headers={"Authorization": f"Bearer {new_token_alpha}"}).json()["conversations"]
    assert len(refreshed_convs) == 1, f"Deleted conversation reappeared after refresh! Total: {len(refreshed_convs)}"
    assert refreshed_convs[0]["id"] == conv2_id
    print("  --> SUCCESS: Deleted conversation does not reappear after refresh")

    # ----------------------------------------------------
    # TEST 6: Rename Conversation 2
    # ----------------------------------------------------
    print("\n[TEST 6] Renaming Conversation 2...")
    res_rename = client.patch(f"/api/chat/conversations/{conv2_id}", json={
        "title": "Updated: Chronic Knee Pain"
    }, headers=headers_alpha)
    assert res_rename.status_code == 200, f"Expected 200 OK, got {res_rename.text}"
    renamed_doc = res_rename.json()["conversation"]
    assert renamed_doc["title"] == "Updated: Chronic Knee Pain"
    # Verify in list
    convs_renamed = client.get("/api/chat/conversations", headers=headers_alpha).json()["conversations"]
    assert convs_renamed[0]["title"] == "Updated: Chronic Knee Pain"
    print("  --> SUCCESS: Conversation 2 title renamed successfully to 'Updated: Chronic Knee Pain'")

    # ----------------------------------------------------
    # TEST 9: Data Protection -> Medical records & profile untouched
    # ----------------------------------------------------
    print("\n[TEST 9] Data Protection check: Verifying medical records and profile are untouched...")
    user_doc = asyncio.run(firestore_user_service.get_user_by_uid(uid_alpha))
    assert user_doc is not None, "User profile was deleted!"
    assert user_doc["displayName"] == "Alpha Patient"

    records = asyncio.run(firestore_record_service.get_medical_records(uid_alpha))
    assert len(records) >= 1, "User health records were deleted or touched!"
    assert any(r.get("id") == rec_id for r in records), f"Medical record {rec_id} was removed!"
    print("  --> SUCCESS: User profile and medical records are 100% intact and preserved")

    # ----------------------------------------------------
    # TEST 10: Clear default conversation endpoint
    # ----------------------------------------------------
    print("\n[TEST 10] Testing clear default conversation endpoint...")
    asyncio.run(firestore_chat_service.save_message(uid_alpha, "conv_default", {
        "role": "user",
        "content": "Hello on default"
    }))
    res_clear = client.delete("/api/chat/clear", headers=headers_alpha)
    assert res_clear.status_code == 200
    assert res_clear.json()["success"] is True
    def_msgs = asyncio.run(firestore_chat_service.get_messages(uid_alpha, "conv_default"))
    assert len(def_msgs) == 0, f"Expected 0 messages in conv_default, got {len(def_msgs)}"
    print("  --> SUCCESS: Clear default conversation succeeded and cleared messages")

    print("\n==================================================")
    print(" ALL 10 DELETE CHAT & CONVERSATION TESTS PASSED!   ")
    print("==================================================")

if __name__ == "__main__":
    run_delete_chat_tests()
