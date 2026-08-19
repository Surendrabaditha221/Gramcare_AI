"""
Symptom Triage Guidance Router for GramCare AI
Manages AI symptom triage evaluations and logs in Firestore subcollection:
users/{uid}/triageLogs/{triageLogId}

Enforces strict Firebase UID scoping and cross-user isolation.
"""
from fastapi import APIRouter, HTTPException, Depends, Header
from typing import List, Optional, Dict, Any
from schemas.triage import TriageRequest, TriageResponse, TriageLogCreate, TriageLogResponse
from services.gemini_service import GeminiService
from services import firestore_triage_service
from services.data_store import memory_store
from routers.auth import get_current_user_from_token
from services.auth_service import decode_token
from services.firebase_admin import verify_firebase_token

router = APIRouter(prefix="/triage", tags=["Symptom Triage"])


@router.post("", response_model=TriageResponse, summary="Perform Symptom Triage Assessment")
async def evaluate_symptom_triage(
    request: TriageRequest,
    authorization: Optional[str] = Header(None)
):
    """
    Evaluates patient symptom report for urgency, recommended next actions, warning signs, and nearby care.
    Persists evaluation in Firestore users/{uid}/triageLogs/{id} when authenticated.
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

    # Determine UID from Authorization header if available
    uid = None
    if isinstance(authorization, str) and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        payload = decode_token(token)
        if payload:
            uid = payload.get("sub") or payload.get("userId") or payload.get("uid")
        else:
            try:
                fb_user = verify_firebase_token(token)
                uid = fb_user.get("uid")
            except Exception:
                pass

    if not uid:
        uid = request.user_id if request.user_id and request.user_id not in ["undefined", "null"] else "user_primary"

    log_entry = {
        "patient": request.patient,
        "patient_id": getattr(request, "patient_id", "user_primary"),
        "user_id": uid,
        "main_complaint": request.main_complaint,
        "symptoms": request.related_symptoms,
        "duration": request.symptom_duration,
        "severity": request.severity,
        "urgency_level": result["urgency_level"],
        "severity_code": result.get("severity_code", "low"),
        "riskLevel": result.get("severity_code", "low"),
        "aiAssessment": result.get("summary_en"),
        "recommendation": result.get("nearby_care_recommendation"),
        "recommended_next_actions_en": result.get("recommended_next_actions_en", []),
        "warning_signs": request.warning_signs,
        "age_group": request.age_group,
        "disclaimer": result.get("disclaimer")
    }

    # Save to Firestore users/{uid}/triageLogs
    await firestore_triage_service.create_triage_log(uid, log_entry)
    memory_store.save_triage_log(log_entry)

    return TriageResponse(**result)


@router.get("/logs", response_model=List[TriageLogResponse], summary="List All Triage Logs for Authenticated User")
async def get_triage_logs(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Returns list of triage logs for the authenticated user from Firestore users/{uid}/triageLogs.
    Strictly enforced by token UID.
    """
    uid = current_user["uid"]
    logs = await firestore_triage_service.get_triage_logs(uid)
    return [TriageLogResponse(**l) for l in logs]


@router.post("/logs", response_model=TriageLogResponse, summary="Create/Save Triage Log Directly")
async def create_triage_log_entry(
    triage_log: TriageLogCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Creates a new triage log directly in Firestore users/{uid}/triageLogs/{id}.
    Enforces verified Firebase token UID.
    """
    uid = current_user["uid"]
    log_dict = triage_log.model_dump(exclude_unset=True)
    log_dict["userId"] = uid  # Override body spoofing

    created = await firestore_triage_service.create_triage_log(uid, log_dict)
    return TriageLogResponse(**created)


@router.get("/logs/{id}", response_model=TriageLogResponse, summary="Get Triage Log Details by ID")
async def get_triage_log_by_id(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Get single triage log details by ID for authenticated user.
    """
    uid = current_user["uid"]
    found = await firestore_triage_service.get_triage_log(uid, id)
    if not found:
        raise HTTPException(status_code=404, detail="Triage log not found")
    return TriageLogResponse(**found)


@router.put("/logs/{id}", response_model=TriageLogResponse, summary="Update Triage Log Details")
async def update_triage_log_entry(
    id: str,
    triage_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Updates an existing triage log in Firestore users/{uid}/triageLogs/{id}.
    """
    uid = current_user["uid"]
    triage_data["userId"] = uid

    updated = await firestore_triage_service.update_triage_log(uid, id, triage_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Triage log not found")
    return TriageLogResponse(**updated)


@router.delete("/logs/{id}", summary="Delete Triage Log")
async def delete_triage_log_entry(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Deletes triage log document from Firestore users/{uid}/triageLogs/{id}.
    """
    uid = current_user["uid"]
    success = await firestore_triage_service.delete_triage_log(uid, id)
    if not success:
        raise HTTPException(status_code=404, detail="Triage log not found")
    return {"status": "success", "message": f"Triage log {id} deleted successfully."}
