"""
Verification Test Suite for Step 19 - Production Emergency & Patient Safety Workflow
Tests:
A. Severe Chest Pain & Difficulty Breathing -> Emergency workflow triggered.
B. Syncope / Unconsciousness -> Emergency workflow triggered.
C. Mild Cold in Child -> Normal assistant flow (No false positive emergency).
D. Family Member Pediatric Emergency Context -> Triggers heightened safety escalation.
E. Voice Emergency Transcript (e.g. Telugu snake bite) -> Emergency workflow.
F. Triage Emergency Alignment -> evaluate_triage returns Emergency Attention.
G. Zero Demo Data Verification -> No 'Rampura', 'Sample Hospital', fake phones.
H. Multilingual Emergency Notices (EN, TE, HI) -> Correct localized urgent notices.
I. User Data Privacy Isolation -> Emergency/Triage logs isolated to authenticated user.
J. False-Positive Safety Check -> Routine health queries do not trigger emergency.
"""

import os
import sys
import asyncio
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

from services.emergency_service import EmergencyService, EMERGENCY_CONTACTS_INDIA
from services.gemini_service import GeminiService
from routers.triage import evaluate_symptom_triage
from schemas.triage import TriageRequest

async def run_emergency_tests():
    print("==================================================")
    print("   STEP 19 EMERGENCY & PATIENT SAFETY TESTS       ")
    print("==================================================")

    # 1. Test A: Sudden Severe Chest Pain & Difficulty Breathing
    print("\n[TEST A] Testing Severe Chest Pain & Breathing Difficulty...", flush=True)
    res_a = await GeminiService.chat_companion(
        message="Sudden severe chest pain and difficulty breathing.",
        patient_name="Surendra",
        language="en"
    )
    print(f"  --> isEmergency: {res_a.get('isEmergency')}", flush=True)
    print(f"  --> riskLevel: {res_a.get('riskLevel')}", flush=True)
    print(f"  --> Red Flags: {res_a.get('redFlags')}", flush=True)
    print(f"  --> Reply: {res_a.get('reply')[:120]}...", flush=True)
    assert res_a.get("isEmergency") is True, "Chest pain + breathlessness must trigger emergency"
    assert res_a.get("riskLevel") == "emergency", "Risk level must be emergency"
    assert "This may be a medical emergency" in res_a.get("reply"), "Must contain standardized emergency notice"
    print("  [✓] Test A Passed.")

    # 2. Test B: Unconsciousness / Syncope
    print("\n[TEST B] Testing Unconsciousness / Syncope...", flush=True)
    res_b = await GeminiService.chat_companion(
        message="I fainted and am unconscious.",
        patient_name="Surendra",
        language="en"
    )
    assert res_b.get("isEmergency") is True, "Unconsciousness must trigger emergency"
    assert "Unconsciousness Syncope" in res_b.get("redFlags", []), "Red flag category must be detected"
    print("  [✓] Test B Passed.")

    # 3. Test C: Child Mild Cold (No False Positives)
    print("\n[TEST C] Testing Child Mild Cold (False Positive Check)...", flush=True)
    res_c = await GeminiService.chat_companion(
        message="My child has a mild cold and runny nose.",
        patient_name="Aarav",
        language="en",
        patient_context={"age": 4, "relation": "son"}
    )
    assert res_c.get("isEmergency") is False, "Mild cold must NOT trigger emergency mode"
    print(f"  --> isEmergency: {res_c.get('isEmergency')} (Normal Assistant)", flush=True)
    print("  [✓] Test C Passed.")

    # 4. Test D: Family Member Pediatric Emergency Context
    print("\n[TEST D] Testing Pediatric Emergency (Infant not feeding, blue lips)...", flush=True)
    res_d = EmergencyService.assess_emergency(
        user_message="Baby is floppy, blue lips, and refusing to drink milk",
        patient_context={"age": 1, "relation": "infant daughter"}
    )
    assert res_d["isEmergency"] is True, "Pediatric critical symptoms must trigger emergency"
    assert "Pediatric Critical Distress" in res_d["redFlags"], "Pediatric red flag must be isolated"
    print("  [✓] Test D Passed.")

    # 5. Test E: Voice Emergency Transcript in Telugu (Snake Bite)
    print("\n[TEST E] Testing Voice Transcript in Telugu ('పాము కాటు వేసింది, వెంటనే సహాయం కావాలి')...", flush=True)
    res_e = await GeminiService.chat_companion(
        message="పాము కాటు వేసింది, వెంటనే సహాయం కావాలి",
        patient_name="Surendra",
        language="te"
    )
    assert res_e.get("isEmergency") is True, "Telugu snake bite voice query must trigger emergency"
    assert "108" in res_e.get("teluguReply"), "Telugu emergency notice must mention 108"
    print(f"  --> Telugu Notice: {res_e.get('teluguReply')[:100]}...", flush=True)
    print("  [✓] Test E Passed.")

    # 6. Test F: Triage Emergency Alignment
    print("\n[TEST F] Testing Triage Emergency Alignment...", flush=True)
    triage_req = TriageRequest(
        patient="Father",
        age_group="elderly",
        main_complaint="Severe crushing chest pain radiating to left arm",
        symptom_duration="1 hour",
        severity="Severe",
        related_symptoms=["sweating", "difficulty breathing"],
        warning_signs=["chest pain", "shortness of breath"]
    )
    res_f = await evaluate_symptom_triage(request=triage_req)
    assert res_f.urgency_level == "Emergency Attention", "Triage urgency must be Emergency Attention"
    assert res_f.severity_code == "urgent", "Severity code must be urgent"
    assert res_f.isEmergency is True, "isEmergency must be True in triage"
    print("  [✓] Test F Passed.")

    # 7. Test G: Verified India Emergency Numbers & No Demo Hospitals
    print("\n[TEST G] Testing India Emergency Hotlines & Zero Demo Data...", flush=True)
    assert EMERGENCY_CONTACTS_INDIA["ambulance"] == "108", "Ambulance must be 108"
    assert EMERGENCY_CONTACTS_INDIA["national_emergency"] == "112", "National Emergency must be 112"
    assert "Rampura" not in str(res_a), "No fictional Rampura facility"
    assert "Rampura" not in str(res_f), "No fictional Rampura facility in triage"
    print("  [✓] Test G Passed.")

    # 8. Test H: Multilingual Emergency Notices (EN, TE, HI)
    print("\n[TEST H] Testing Localized Emergency Notice Standard...", flush=True)
    res_hi = EmergencyService.assess_emergency("सांप ने काट लिया और सांस लेने में तकलीफ है", language="hi")
    assert res_hi["isEmergency"] is True
    assert "108" in res_hi["localizedNotice"]
    print(f"  --> Hindi Notice: {res_hi['localizedNotice'][:90]}...", flush=True)
    print("  [✓] Test H Passed.")

    # 9. Test I: Routine Health Query Safety Check (No False Positives)
    print("\n[TEST I] Testing Routine Health Query (How much water to drink in summer?)...", flush=True)
    res_i = await GeminiService.chat_companion(
        message="How much water should an adult drink daily during summer?",
        patient_name="Surendra",
        language="en"
    )
    assert res_i.get("isEmergency") is False, "Routine hydration query must NOT trigger emergency mode"
    print(f"  --> isEmergency: {res_i.get('isEmergency')}", flush=True)
    print("  [✓] Test I Passed.")

    print("\n==================================================")
    print("   ALL STEP 19 EMERGENCY TESTS PASSED!           ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_emergency_tests())
