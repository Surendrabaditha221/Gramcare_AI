"""
Symptom Triage Guidance Router
"""
from fastapi import APIRouter
from schemas import TriageRequest, TriageResponse
from services.gemini_service import GeminiService
from database import crud
from services.data_store import memory_store

router = APIRouter()

@router.post("/triage", response_model=TriageResponse, summary="Perform Symptom Triage Assessment")
async def evaluate_symptom_triage(request: TriageRequest):
    """
    Evaluates patient symptom report for urgency, recommended next actions, warning signs, and nearby PHC care.
    Includes strict medical disclaimer that output is health guidance and not diagnosis.
    """
    result = await GeminiService.evaluate_triage(
        patient=request.patient,
        main_complaint=request.main_complaint,
        duration=request.symptom_duration,
        severity=request.severity,
        related_symptoms=request.related_symptoms,
        warning_signs=request.warning_signs,
        age_group=request.age_group
    )

    log_entry = {
        "patient": request.patient,
        "patient_id": getattr(request, "patient_id", "user_primary"),
        "user_id": getattr(request, "user_id", "user_primary"),
        "main_complaint": request.main_complaint,
        "urgency_level": result["urgency_level"],
        "severity_code": result.get("severity_code", "low"),
        "nearby_care": result.get("nearby_care_recommendation")
    }

    await crud.save_triage_log(log_entry)
    memory_store.save_triage_log(log_entry)

    return TriageResponse(**result)
