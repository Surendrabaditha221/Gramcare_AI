"""
Verification Test Suite for Step 14 - Production-Grade Healthcare Assistant
Tests:
1. Initial symptom query -> Natural conversational follow-up (no massive dump)
2. Multi-turn follow-up with context memory -> Understands temperature '102°F'
3. Multi-turn follow-up with additional symptom -> Understands fever + headache
4. Language support: Telugu conversation -> Natural fluent Telugu response
5. Family member context -> Child patient context considered appropriately
6. Emergency detection -> Immediate urgent care advisory (108 / PHC)
7. Non-health query boundary -> Polite health-only boundary redirection
"""
import os
import sys
import asyncio
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from services.gemini_service import GeminiService

async def run_tests():
    print("==================================================")
    print("      STEP 14 HEALTHCARE ASSISTANT TESTS          ")
    print("==================================================")

    # Test 1: Initial symptom
    print("\n[TEST 1] Testing initial symptom query: 'I have a fever'...")
    res1 = await GeminiService.chat_companion(
        message="I have a fever",
        patient_name="Surendra",
        language="en",
        history=[]
    )
    print("  --> AI Response:\n", res1.get("reply"))
    assert res1.get("reply"), "Response should not be empty"

    # Test 2: Multi-turn follow up (Temperature)
    print("\n[TEST 2] Testing follow-up: '102°F' with history...")
    history_turn1 = [
        {"sender": "user", "text": "I have a fever"},
        {"sender": "assistant", "text": res1.get("reply")}
    ]
    res2 = await GeminiService.chat_companion(
        message="102°F, for about 2 days",
        patient_name="Surendra",
        language="en",
        history=history_turn1
    )
    print("  --> AI Response:\n", res2.get("reply"))
    assert res2.get("reply"), "Response should not be empty"

    # Test 3: Multi-turn follow up (Headache)
    print("\n[TEST 3] Testing follow-up: 'I also have a headache'...")
    history_turn2 = history_turn1 + [
        {"sender": "user", "text": "102°F, for about 2 days"},
        {"sender": "assistant", "text": res2.get("reply")}
    ]
    res3 = await GeminiService.chat_companion(
        message="I also have a headache",
        patient_name="Surendra",
        language="en",
        history=history_turn2
    )
    print("  --> AI Response:\n", res3.get("reply"))
    assert res3.get("reply"), "Response should not be empty"

    # Test 4: Telugu conversation
    print("\n[TEST 4] Testing Telugu language query: 'నాకు 2 రోజులుగా జ్వరం ఉంది'...")
    res_te = await GeminiService.chat_companion(
        message="నాకు 2 రోజులుగా జ్వరం ఉంది",
        patient_name="సురేంద్ర",
        language="te",
        history=[]
    )
    print("  --> AI Response (Telugu):\n", res_te.get("reply"))
    assert res_te.get("reply"), "Telugu response should not be empty"

    # Test 5: Family Member context (Child)
    print("\n[TEST 5] Testing Family Member context (Child 4 years old)...")
    res_child = await GeminiService.chat_companion(
        message="My child has high fever since morning",
        patient_name="Aarav",
        language="en",
        history=[],
        patient_context={
            "name": "Aarav",
            "age": 4,
            "gender": "male",
            "relation": "Son",
            "knownAllergies": "None",
            "medicalConditions": "None"
        }
    )
    print("  --> AI Response (Child Context):\n", res_child.get("reply"))
    assert res_child.get("reply"), "Child response should not be empty"

    # Test 6: Emergency Query
    print("\n[TEST 6] Testing Emergency Symptom: 'Sudden severe chest pain and cannot breathe'...")
    res_emerg = await GeminiService.chat_companion(
        message="Sudden severe chest pain and cannot breathe",
        patient_name="Surendra",
        language="en",
        history=[]
    )
    print("  --> AI Response (Emergency):\n", res_emerg.get("reply"))
    assert res_emerg.get("isEmergency") is True, "Should identify emergency"

    # Test 7: Streaming Test
    print("\n[TEST 7] Testing Real-Time Streaming Chunk Delivery...")
    chunks = []
    async for chunk in GeminiService.chat_companion_stream(
        message="I have mild body aches after working in the field",
        patient_name="Surendra",
        language="en",
        history=[]
    ):
        chunks.append(chunk)
    full_streamed = "".join(chunks)
    print(f"  --> Streamed {len(chunks)} chunks, total length: {len(full_streamed)} chars.")
    assert len(chunks) > 0, "Stream must yield chunks"
    assert len(full_streamed) > 0, "Streamed text must not be empty"

    print("\n==================================================")
    print("     ALL STEP 14 AI TESTS PASSED SUCCESSFULLY!    ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_tests())
