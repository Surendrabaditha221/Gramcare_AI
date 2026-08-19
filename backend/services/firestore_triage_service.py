"""
Firestore Triage Logs Service for GramCare AI
Manages symptom triage evaluation history exclusively in Firestore subcollection:
users/{uid}/triageLogs/{triageLogId}

Enforces strict Firebase UID security and user isolation.
"""
from datetime import datetime
import logging
import secrets
from typing import Dict, Any, List, Optional
from services.firebase_admin import get_firestore_client
from services import firestore_family_service

logger = logging.getLogger("gramcare.firestore_triage")

# In-memory fallback for offline/test environments
_in_memory_triage: Dict[str, Dict[str, Dict[str, Any]]] = {}


def _generate_triage_id() -> str:
    return f"triage_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(3)}"


async def create_triage_log(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates a new triage log document in users/{uid}/triageLogs/{triageLogId}.
    """
    if not uid:
        raise ValueError("UID is required to create a triage log")

    triage_id = data.get("id") or _generate_triage_id()
    now = datetime.now().isoformat()

    # Patient / Family member association
    patient_id = data.get("patient_id") or data.get("patientId") or "user_primary"
    patient_name = data.get("patient") or data.get("patientName")
    if patient_id and patient_id != "user_primary" and not patient_name:
        family_member = await firestore_family_service.get_family_member(uid, patient_id)
        if family_member:
            patient_name = family_member.get("fullName")

    # Map symptom and assessment fields
    symptoms = data.get("symptoms") or data.get("related_symptoms") or data.get("reportedSymptoms") or []
    warning_signs = data.get("warning_signs") or data.get("warningSigns") or []
    recommended_actions = data.get("recommended_next_actions_en") or data.get("recommendedNextActions") or []
    possible_conditions = data.get("possibleConditions") or data.get("possible_conditions") or []

    triage_doc = {
        "id": triage_id,
        "userId": uid,
        "patientId": patient_id,
        "patientName": patient_name,
        "mainComplaint": data.get("main_complaint") or data.get("mainComplaint") or "",
        "symptoms": symptoms,
        "duration": data.get("symptom_duration") or data.get("duration"),
        "severity": data.get("severity") or data.get("severity_code"),
        "possibleConditions": possible_conditions,
        "riskLevel": data.get("riskLevel") or data.get("urgency_level") or data.get("urgencyCategory") or "low",
        "urgencyLevel": data.get("urgency_level") or data.get("urgencyCategory") or data.get("riskLevel") or "low",
        "aiAssessment": data.get("aiAssessment") or data.get("summary_en") or data.get("summary"),
        "recommendation": data.get("recommendation") or data.get("nearby_care") or data.get("nearby_care_recommendation"),
        "recommendedNextActions": recommended_actions,
        "warningSigns": warning_signs,
        "ageGroup": data.get("age_group") or data.get("ageGroup") or "adult",
        "additionalDetails": data.get("additional_details") or data.get("additionalDetails"),
        "disclaimer": data.get("disclaimer") or "GramCare AI Triage Guidance Only — Does not replace professional medical diagnosis.",
        "createdAt": data.get("createdAt") or now,
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("triageLogs").document(triage_id)
            doc_ref.set(triage_doc, merge=True)
            logger.info(f"Created Firestore triage log users/{uid}/triageLogs/{triage_id}")
        except Exception as e:
            logger.warning(f"Firestore create_triage_log error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_triage:
        _in_memory_triage[uid] = {}
    _in_memory_triage[uid][triage_id] = triage_doc

    return triage_doc


async def get_triage_logs(uid: str) -> List[Dict[str, Any]]:
    """
    Retrieves all triage logs for the authenticated user from users/{uid}/triageLogs.
    """
    if not uid:
        return []

    db = get_firestore_client()
    if db:
        try:
            coll_ref = db.collection("users").document(uid).collection("triageLogs")
            docs = coll_ref.stream()
            logs = [d.to_dict() for d in docs]
            if logs:
                return sorted(logs, key=lambda x: x.get("createdAt", ""), reverse=True)
            return []
        except Exception as e:
            logger.warning(f"Firestore get_triage_logs error: {e}. Falling back to in-memory store.")

    user_store = _in_memory_triage.get(uid, {})
    return sorted(list(user_store.values()), key=lambda x: x.get("createdAt", ""), reverse=True)


async def get_triage_log(uid: str, triage_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single triage log by ID for the authenticated user.
    """
    if not uid or not triage_id:
        return None

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("triageLogs").document(triage_id)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.warning(f"Firestore get_triage_log error: {e}. Falling back to in-memory store.")

    return _in_memory_triage.get(uid, {}).get(triage_id)


async def update_triage_log(uid: str, triage_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Updates an existing triage log in users/{uid}/triageLogs/{triageLogId}.
    """
    if not uid or not triage_id:
        return None

    existing = await get_triage_log(uid, triage_id)
    if not existing:
        return None

    now = datetime.now().isoformat()
    updated_doc = {
        **existing,
        **data,
        "id": triage_id,
        "userId": uid,  # Preserve UID ownership
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("triageLogs").document(triage_id)
            doc_ref.set(updated_doc, merge=True)
            logger.info(f"Updated Firestore triage log users/{uid}/triageLogs/{triage_id}")
        except Exception as e:
            logger.warning(f"Firestore update_triage_log error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_triage:
        _in_memory_triage[uid] = {}
    _in_memory_triage[uid][triage_id] = updated_doc

    return updated_doc


async def delete_triage_log(uid: str, triage_id: str) -> bool:
    """
    Deletes a triage log document from users/{uid}/triageLogs/{triageLogId}.
    """
    if not uid or not triage_id:
        return False

    existing = await get_triage_log(uid, triage_id)
    if not existing:
        return False

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("triageLogs").document(triage_id)
            doc_ref.delete()
            logger.info(f"Deleted Firestore triage log users/{uid}/triageLogs/{triage_id}")
        except Exception as e:
            logger.warning(f"Firestore delete_triage_log error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_triage and triage_id in _in_memory_triage[uid]:
        del _in_memory_triage[uid][triage_id]

    return True
