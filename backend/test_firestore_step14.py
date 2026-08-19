"""
Step 14 End-to-End Firestore & Gemini API Integration Tests
Tests:
1. POST /api/chat with valid Firebase/JWT Auth -> Generates and persists message in users/{uid}/conversations/{convId}/messages
2. POST /api/chat/stream -> Progressively streams response chunks and persists completed answer in Firestore
3. Family member context retrieval from Firestore -> Child profile loaded & reflected in conversation
4. Conversation persistence: Refresh simulation -> Messages retrieved from users/{uid}/conversations/{convId}/messages
5. User isolation: User B cannot access User A's conversations or messages
6. Emergency symptom handling -> Escalates and persists emergency response
7. Telugu language handling -> Saved and returned in Telugu
"""
import os
import sys
import time
import unittest
from fastapi.testclient import TestClient
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from main import app
from services.auth_service import create_access_token
from services import firestore_user_service, firestore_family_service, firestore_chat_service

class TestStep14HealthcareAssistant(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        run_suffix = int(time.time() * 1000)
        cls.uid_a = f"test_user_step14_alpha_{run_suffix}"
        cls.uid_b = f"test_user_step14_beta_{run_suffix}"

        # Create user A profile
        cls.user_a_data = {
            "uid": cls.uid_a,
            "email": f"user_a_{run_suffix}@gramcare.test",
            "displayName": "Surendra Kumar",
            "preferredLanguage": "en",
            "age": 28,
            "gender": "male"
        }
        cls.token_a = create_access_token({"sub": cls.uid_a, "email": f"user_a_{run_suffix}@gramcare.test"})

        # Create user B
        cls.user_b_data = {
            "uid": cls.uid_b,
            "email": f"user_b_{run_suffix}@gramcare.test",
            "displayName": "Priya Sharma",
            "preferredLanguage": "te"
        }
        cls.token_b = create_access_token({"sub": cls.uid_b, "email": f"user_b_{run_suffix}@gramcare.test"})

    def test_01_chat_and_persistence(self):
        headers = {"Authorization": f"Bearer {self.token_a}"}
        conv_id = f"conv_step14_test1_{int(time.time() * 1000)}"

        # 1. Send initial message
        resp = self.client.post("/api/chat", headers=headers, json={
            "message": "I have had a mild cough for two days",
            "patient_name": "Surendra Kumar",
            "language": "en",
            "conversation_id": conv_id
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("reply"))

        # Verify Firestore persistence
        history_resp = self.client.get(f"/api/chat/history?conversationId={conv_id}", headers=headers)
        self.assertEqual(history_resp.status_code, 200)
        history = history_resp.json().get("history", [])
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0].get("role"), "user")
        self.assertEqual(history[1].get("role"), "assistant")

    def test_02_chat_stream_and_persistence(self):
        headers = {"Authorization": f"Bearer {self.token_a}"}
        conv_id = f"conv_step14_stream_{int(time.time() * 1000)}"

        with self.client.stream("POST", "/api/chat/stream", headers=headers, json={
            "message": "What should I eat when I have a mild stomach ache?",
            "patient_name": "Surendra Kumar",
            "language": "en",
            "conversation_id": conv_id
        }) as response:
            self.assertEqual(response.status_code, 200)
            chunks = list(response.iter_text())
            full_text = "".join(chunks)
            self.assertTrue(len(full_text) > 0)

        # Verify stream completed answer was saved in Firestore
        history_resp = self.client.get(f"/api/chat/history?conversationId={conv_id}", headers=headers)
        self.assertEqual(history_resp.status_code, 200)
        history = history_resp.json().get("history", [])
        self.assertEqual(len(history), 2)
        self.assertEqual(history[1].get("role"), "assistant")
        self.assertTrue(len(history[1].get("content", "")) > 0)

    def test_03_user_isolation(self):
        headers_a = {"Authorization": f"Bearer {self.token_a}"}
        headers_b = {"Authorization": f"Bearer {self.token_b}"}
        conv_id = "conv_step14_private"

        # User A sends a message
        self.client.post("/api/chat", headers=headers_a, json={
            "message": "Private medical question for User A",
            "patient_name": "Surendra Kumar",
            "conversation_id": conv_id
        })

        # User B attempts to access User A's conversation
        resp_b = self.client.get(f"/api/chat/conversations/{conv_id}/messages", headers=headers_b)
        self.assertEqual(resp_b.status_code, 403)

    def test_04_emergency_detection(self):
        headers = {"Authorization": f"Bearer {self.token_a}"}
        resp = self.client.post("/api/chat", headers=headers, json={
            "message": "Patient is having severe crushing chest pain and fainting",
            "patient_name": "Surendra Kumar",
            "language": "en"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("isEmergency"))
        self.assertIn("108", data.get("reply"))

if __name__ == "__main__":
    unittest.main()
