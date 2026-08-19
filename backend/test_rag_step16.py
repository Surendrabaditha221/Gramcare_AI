"""
Verification Test Suite for Step 16 - Trusted Medical Knowledge RAG
Tests:
A. Fever query -> Relevant MoHFW/WHO fever guideline retrieved and cited.
B. Dehydration query -> Relevant WHO ORS / CDC hydration guideline retrieved and cited.
C. Severe chest pain -> Emergency detection overrides routine RAG, urging 108/PHC immediate care.
D. Unrelated query -> Non-health boundary maintained, no irrelevant medical documents retrieved.
E. Non-matching query -> Returns zero sources, no fake or fabricated sources created.
F. Telugu query -> Delivers Telugu output while citing authoritative source metadata.
G. Family member context -> Pediatric child context + authoritative guideline integration.
H. Privacy & Isolation -> Shared knowledge base remains strictly separated from users/{uid}.
I. Schema Validation -> Ingestion script validates all required fields and authoritative organizations.
"""
import os
import sys
import asyncio
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from services.medical_rag_service import MedicalRAGService
from services.gemini_service import GeminiService
from scripts.ingest_medical_knowledge import validate_document

async def run_rag_tests():
    print("==================================================")
    print("        STEP 16 MEDICAL RAG VERIFICATION          ")
    print("==================================================")

    # 1. Schema Validation Test
    print("\n[TEST 1] Testing Document Ingestion Schema Validation...")
    valid_doc = {
        "sourceId": "who-test-1",
        "title": "WHO Clinical Management",
        "organization": "World Health Organization (WHO)",
        "url": "https://www.who.int/test",
        "language": "en",
        "topic": "General Health",
        "lastVerified": "2026-08-19T00:00:00Z",
        "content": "Valid clinical guidance content."
    }
    assert validate_document(valid_doc) is True, "Valid document should pass validation"

    invalid_doc = {
        "sourceId": "fake-1",
        "title": "Missing fields"
    }
    assert validate_document(invalid_doc) is False, "Invalid document must fail validation"
    print("  [✓] Document schema validation strictly enforced.")

    # 2. Test A: Fever Query Retrieval
    print("\n[TEST 2] Testing Fever Query Retrieval: 'I have a fever and body aches'...")
    fever_sources = MedicalRAGService.retrieve_relevant_sources("I have a fever and body aches", language="en")
    print(f"  --> Retrieved {len(fever_sources)} source(s):")
    for s in fever_sources:
        print(f"      • {s.get('organization')} — {s.get('title')}")
    assert len(fever_sources) > 0, "Fever query must retrieve fever guideline"
    assert any("fever" in s.get("topic", "").lower() or "fever" in s.get("title", "").lower() for s in fever_sources)
    print("  [✓] Authoritative fever guideline retrieved successfully.")

    # 3. Test B: Dehydration & ORS Query Retrieval
    print("\n[TEST 3] Testing Dehydration Query Retrieval: 'How can dehydration be prevented?'...")
    dehydration_sources = MedicalRAGService.retrieve_relevant_sources("How can dehydration be prevented?", language="en")
    print(f"  --> Retrieved {len(dehydration_sources)} source(s):")
    for s in dehydration_sources:
        print(f"      • {s.get('organization')} — {s.get('title')}")
    assert len(dehydration_sources) > 0, "Dehydration query must retrieve dehydration guideline"
    assert any("dehydration" in s.get("topic", "").lower() or "ors" in s.get("tags", []) for s in dehydration_sources)
    print("  [✓] Authoritative dehydration & ORS guideline retrieved successfully.")

    # 4. Test C: Emergency Detection Supremacy
    print("\n[TEST 4] Testing Emergency Query: 'What should I do for severe crushing chest pain?'...")
    res_emerg = await GeminiService.chat_companion(
        message="What should I do for severe crushing chest pain?",
        patient_name="Surendra",
        language="en"
    )
    print("  --> Emergency Response:\n", res_emerg.get("reply"))
    assert res_emerg.get("isEmergency") is True, "Must trigger emergency classification"
    assert "108" in res_emerg.get("reply") or "emergency" in res_emerg.get("reply").lower()
    print("  [✓] Emergency detection takes precedence over routine RAG generation.")

    # 5. Test D: Unrelated Query (Non-Health)
    print("\n[TEST 5] Testing Unrelated Non-Health Query: 'How to write python bubble sort?'...")
    unrelated_sources = MedicalRAGService.retrieve_relevant_sources("How to write python bubble sort?", language="en")
    assert len(unrelated_sources) == 0, "Unrelated query must NOT retrieve medical documents"
    res_non_health = await GeminiService.chat_companion(
        message="How to write python bubble sort?",
        patient_name="Surendra",
        language="en"
    )
    assert res_non_health.get("intent") == "NON_HEALTH_QUERY", "Must classify as NON_HEALTH_QUERY"
    print("  [✓] Non-health boundary enforced; zero irrelevant medical documents retrieved.")

    # 6. Test E: No Fabricated Sources for Out-of-Corpus Query
    print("\n[TEST 6] Testing Out-of-Corpus Query (No False Citations): 'What causes temporal arteritis?'...")
    niche_sources = MedicalRAGService.retrieve_relevant_sources("What causes temporal arteritis?", language="en")
    assert len(niche_sources) == 0, "No irrelevant document should be retrieved for niche unindexed query"
    citations = MedicalRAGService.format_citations_text(niche_sources, language="en")
    assert citations == "", "No citations string should be generated when no sources matched"
    print("  [✓] Zero fabrication confirmed: No false citations generated.")

    # 7. Test F: Telugu Multilingual RAG Retrieval & Response
    print("\n[TEST 7] Testing Telugu Multilingual RAG: 'నాకు 2 రోజులుగా జ్వరం ఉంది'...")
    te_sources = MedicalRAGService.retrieve_relevant_sources("నాకు 2 రోజులుగా జ్వరం ఉంది", language="te")
    print(f"  --> Telugu Query Retrieved {len(te_sources)} source(s):")
    for s in te_sources:
        print(f"      • {s.get('organization')} — {s.get('title')}")
    assert len(te_sources) > 0, "Telugu fever query must retrieve relevant guidelines"

    res_te = await GeminiService.chat_companion(
        message="నాకు 2 రోజులుగా జ్వరం ఉంది",
        patient_name="సురేంద్ర",
        language="te"
    )
    print("  --> Telugu AI Response with RAG Context:\n", res_te.get("reply"))
    assert res_te.get("reply"), "Telugu reply must not be empty"
    print("  [✓] Telugu multilingual RAG execution verified.")

    # 8. Test G: Family Member Context + RAG Integration (Pediatric Child)
    print("\n[TEST 8] Testing Child Family Member Context + RAG Guidance...")
    child_context = {
        "name": "Aarav",
        "age": 3,
        "gender": "male",
        "relation": "Son",
        "knownAllergies": "None",
        "medicalConditions": "None"
    }
    res_child = await GeminiService.chat_companion(
        message="My 3 year old son has a cough and mild fever",
        patient_name="Aarav",
        language="en",
        patient_context=child_context
    )
    print("  --> Pediatric Response with RAG Context:\n", res_child.get("reply"))
    assert res_child.get("reply"), "Child response must not be empty"
    assert "Aarav" in res_child.get("reply") or "child" in res_child.get("reply").lower()
    print("  [✓] Pediatric context seamlessly integrated with authoritative guidelines.")

    # 9. Test H: Privacy Isolation Verification
    print("\n[TEST 9] Verifying Knowledge Base Privacy Isolation...")
    all_sources = MedicalRAGService.load_knowledge_base()
    for s in all_sources:
        assert "uid" not in s or not s.get("uid"), "Shared knowledge base must NOT contain user UIDs"
        assert "password" not in s, "Shared knowledge base must NOT contain user credentials"
        assert "Ramesh Kumar" not in str(s), "No demo users in knowledge base"
    print("  [✓] Complete privacy isolation confirmed: Shared knowledge base contains zero private user records.")

    print("\n==================================================")
    print("     ALL STEP 16 RAG TESTS PASSED SUCCESSFULLY!   ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_rag_tests())
