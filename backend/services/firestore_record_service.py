"""
Firestore Medical Record Service for GramCare AI
Manages clinical/health records in Firestore collection structure:
users/{uid}/medicalRecords/{recordId}

Enforces strict UID scoping for all read, create, update, and delete operations.
"""
from datetime import datetime
import logging
from typing import Dict, Any, List, Optional
import uuid
from services.firebase_admin import get_firestore_client

logger = logging.getLogger("gramcare.firestore_records")

# In-memory store fallback for offline/test environments
_in_memory_records: Dict[str, Dict[str, Dict[str, Any]]] = {}


def _new_id(prefix: str = "rec") -> str:
    return f"{prefix}_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:6]}"


async def create_medical_record(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates a medical record under users/{uid}/medicalRecords/{recordId}.
    """
    if not uid:
        raise ValueError("UID is required to create a medical record")

    record_id = data.get("id") or _new_id("rec")
    now = datetime.now().isoformat()

    record_doc = {
        "id": record_id,
        "userId": uid,
        "patientId": data.get("patientId") or uid,
        "patientName": data.get("patientName") or "Primary User",
        "title": data.get("title") or "Medical Consultation",
        "teluguTitle": data.get("teluguTitle") or None,
        "type": data.get("type") or "medical_document",
        "recordType": data.get("recordType") or data.get("type") or "medical_document",
        "date": data.get("date") or now[:10],
        "summary": data.get("summary") or "",
        "teluguSummary": data.get("teluguSummary") or None,
        "facilityOrDoctor": data.get("facilityOrDoctor") or data.get("doctorName") or None,
        "doctorName": data.get("doctorName") or data.get("facilityOrDoctor") or None,
        "hospitalName": data.get("hospitalName") or None,
        "diagnosis": data.get("diagnosis") or None,
        "symptoms": data.get("symptoms") or [],
        "medicines": data.get("medicines") or data.get("prescriptions") or [],
        "prescriptions": data.get("prescriptions") or data.get("medicines") or [],
        "labResults": data.get("labResults") or [],
        "downloadUrl": data.get("downloadUrl") or data.get("uploadedFileUrl") or None,
        "uploadedFileUrl": data.get("uploadedFileUrl") or data.get("downloadUrl") or None,
        "tags": data.get("tags") or [],
        "createdAt": data.get("createdAt") or now,
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("medicalRecords").document(record_id)
            doc_ref.set(record_doc, merge=True)
            logger.info(f"Created Firestore medical record users/{uid}/medicalRecords/{record_id}")
            return record_doc
        except Exception as e:
            logger.warning(f"Firestore create_medical_record error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_records:
        _in_memory_records[uid] = {}
    _in_memory_records[uid][record_id] = record_doc
    return record_doc


async def get_medical_records(uid: str, patient_id: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetches all medical records for users/{uid}/medicalRecords.
    Optionally filters by patientId.
    """
    if not uid:
        return []

    db = get_firestore_client()
    if db:
        try:
            records_ref = db.collection("users").document(uid).collection("medicalRecords")
            if patient_id:
                docs = records_ref.where("patientId", "==", patient_id).stream()
            else:
                docs = records_ref.stream()

            results = [d.to_dict() for d in docs]
            results.sort(key=lambda x: x.get("createdAt") or x.get("date") or "", reverse=True)
            return results
        except Exception as e:
            logger.warning(f"Firestore get_medical_records error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_records:
        records_list = list(_in_memory_records[uid].values())
        if patient_id:
            records_list = [r for r in records_list if r.get("patientId") == patient_id]
        records_list.sort(key=lambda x: x.get("createdAt") or x.get("date") or "", reverse=True)
        return records_list
    return []


async def get_medical_record(uid: str, record_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves single medical record users/{uid}/medicalRecords/{recordId}.
    Enforces UID ownership.
    """
    if not uid or not record_id:
        return None

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("medicalRecords").document(record_id)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.warning(f"Firestore get_medical_record error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_records:
        return _in_memory_records[uid].get(record_id)
    return None


async def update_medical_record(uid: str, record_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates medical record users/{uid}/medicalRecords/{recordId}.
    """
    existing = await get_medical_record(uid, record_id)
    if not existing:
        raise ValueError(f"Record {record_id} not found for UID {uid}")

    now = datetime.now().isoformat()
    updates = dict(data)
    updates["id"] = record_id
    updates["userId"] = uid
    updates["updatedAt"] = now

    merged = {**existing, **updates}

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("medicalRecords").document(record_id)
            doc_ref.set(merged, merge=True)
            return merged
        except Exception as e:
            logger.warning(f"Firestore update_medical_record error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_records:
        _in_memory_records[uid] = {}
    _in_memory_records[uid][record_id] = merged
    return merged


async def delete_medical_record(uid: str, record_id: str) -> bool:
    """
    Deletes medical record users/{uid}/medicalRecords/{recordId}.
    """
    if not uid or not record_id:
        return False

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("medicalRecords").document(record_id)
            if not doc_ref.get().exists:
                return False
            doc_ref.delete()
            return True
        except Exception as e:
            logger.warning(f"Firestore delete_medical_record error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_records and record_id in _in_memory_records[uid]:
        del _in_memory_records[uid][record_id]
        return True
    return False
