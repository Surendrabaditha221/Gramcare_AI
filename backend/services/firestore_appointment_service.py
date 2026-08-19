"""
Firestore Appointments Service for GramCare AI
Manages appointment documents in Firestore subcollection:
users/{uid}/appointments/{appointmentId}

Enforces strict Firebase UID security and user isolation.
"""
from datetime import datetime
import logging
import secrets
from typing import Dict, Any, List, Optional
from services.firebase_admin import get_firestore_client
from services import firestore_family_service

logger = logging.getLogger("gramcare.firestore_appointments")

# In-memory fallback for offline/test environments
_in_memory_appointments: Dict[str, Dict[str, Dict[str, Any]]] = {}


def _generate_appointment_id() -> str:
    return f"apt_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(3)}"


async def create_appointment(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates a new appointment document in users/{uid}/appointments/{appointmentId}.
    """
    if not uid:
        raise ValueError("UID is required to create an appointment")

    appointment_id = data.get("id") or _generate_appointment_id()
    now = datetime.now().isoformat()

    # If patientId belongs to a family member, verify and attach family member name if missing
    patient_id = data.get("patientId") or "user_primary"
    patient_name = data.get("patientName")
    if patient_id and patient_id != "user_primary" and not patient_name:
        family_member = await firestore_family_service.get_family_member(uid, patient_id)
        if family_member:
            patient_name = family_member.get("fullName")

    appointment = {
        "id": appointment_id,
        "userId": uid,
        "patientId": patient_id,
        "patientName": patient_name,
        "doctorName": data.get("doctorName"),
        "hospitalName": data.get("hospitalName") or data.get("facilityName"),
        "specialty": data.get("specialty"),
        "appointmentDate": data.get("appointmentDate"),
        "appointmentTime": data.get("appointmentTime"),
        "status": data.get("status", "scheduled"),
        "reason": data.get("reason"),
        "notes": data.get("notes"),
        "createdAt": data.get("createdAt") or now,
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("appointments").document(appointment_id)
            doc_ref.set(appointment, merge=True)
            logger.info(f"Created Firestore appointment users/{uid}/appointments/{appointment_id}")
        except Exception as e:
            logger.warning(f"Firestore create_appointment error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_appointments:
        _in_memory_appointments[uid] = {}
    _in_memory_appointments[uid][appointment_id] = appointment

    return appointment


async def get_appointments(uid: str) -> List[Dict[str, Any]]:
    """
    Retrieves all appointments for the authenticated user from users/{uid}/appointments.
    """
    if not uid:
        return []

    db = get_firestore_client()
    if db:
        try:
            coll_ref = db.collection("users").document(uid).collection("appointments")
            docs = coll_ref.stream()
            apts = [d.to_dict() for d in docs]
            if apts:
                return sorted(apts, key=lambda x: x.get("appointmentDate") or x.get("createdAt", ""), reverse=True)
            return []
        except Exception as e:
            logger.warning(f"Firestore get_appointments error: {e}. Falling back to in-memory store.")

    user_store = _in_memory_appointments.get(uid, {})
    return sorted(list(user_store.values()), key=lambda x: x.get("appointmentDate") or x.get("createdAt", ""), reverse=True)


async def get_appointment(uid: str, appointment_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single appointment by ID for the authenticated user.
    """
    if not uid or not appointment_id:
        return None

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("appointments").document(appointment_id)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.warning(f"Firestore get_appointment error: {e}. Falling back to in-memory store.")

    return _in_memory_appointments.get(uid, {}).get(appointment_id)


async def update_appointment(uid: str, appointment_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Updates an existing appointment in users/{uid}/appointments/{appointmentId}.
    """
    if not uid or not appointment_id:
        return None

    existing = await get_appointment(uid, appointment_id)
    if not existing:
        return None

    now = datetime.now().isoformat()
    updated_apt = {
        **existing,
        **data,
        "id": appointment_id,
        "userId": uid,  # Preserve UID ownership
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("appointments").document(appointment_id)
            doc_ref.set(updated_apt, merge=True)
            logger.info(f"Updated Firestore appointment users/{uid}/appointments/{appointment_id}")
        except Exception as e:
            logger.warning(f"Firestore update_appointment error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_appointments:
        _in_memory_appointments[uid] = {}
    _in_memory_appointments[uid][appointment_id] = updated_apt

    return updated_apt


async def cancel_appointment(uid: str, appointment_id: str) -> Optional[Dict[str, Any]]:
    """
    Cancels an appointment by setting status to 'cancelled'.
    """
    return await update_appointment(uid, appointment_id, {"status": "cancelled"})


async def delete_appointment(uid: str, appointment_id: str) -> bool:
    """
    Deletes an appointment document from users/{uid}/appointments/{appointmentId}.
    """
    if not uid or not appointment_id:
        return False

    existing = await get_appointment(uid, appointment_id)
    if not existing:
        return False

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("appointments").document(appointment_id)
            doc_ref.delete()
            logger.info(f"Deleted Firestore appointment users/{uid}/appointments/{appointment_id}")
        except Exception as e:
            logger.warning(f"Firestore delete_appointment error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_appointments and appointment_id in _in_memory_appointments[uid]:
        del _in_memory_appointments[uid][appointment_id]

    return True
