"""
Firestore Family Members Service for GramCare AI
Manages family member documents in Firestore subcollection:
users/{uid}/familyMembers/{memberId}

Enforces strict Firebase UID security and user isolation.
"""
from datetime import datetime
import logging
import secrets
from typing import Dict, Any, List, Optional
from services.firebase_admin import get_firestore_client

logger = logging.getLogger("gramcare.firestore_family")

# In-memory fallback for offline/test environments
_in_memory_family: Dict[str, Dict[str, Dict[str, Any]]] = {}


def _generate_member_id() -> str:
    return f"fam_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(3)}"


async def create_family_member(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates a new family member document in users/{uid}/familyMembers/{memberId}.
    """
    if not uid:
        raise ValueError("UID is required to create a family member")

    member_id = data.get("id") or _generate_member_id()
    now = datetime.now().isoformat()

    family_member = {
        "id": member_id,
        "userId": uid,
        "fullName": data.get("fullName", "").strip(),
        "relation": data.get("relation", "Other"),
        "dob": data.get("dob"),
        "age": data.get("age"),
        "gender": data.get("gender", "other"),
        "bloodGroup": data.get("bloodGroup"),
        "phone": data.get("phone"),
        "knownAllergies": data.get("knownAllergies"),
        "medicalConditions": data.get("medicalConditions"),
        "currentMedications": data.get("currentMedications"),
        "createdAt": data.get("createdAt") or now,
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("familyMembers").document(member_id)
            doc_ref.set(family_member, merge=True)
            logger.info(f"Created Firestore family member users/{uid}/familyMembers/{member_id}")
        except Exception as e:
            logger.warning(f"Firestore create_family_member error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_family:
        _in_memory_family[uid] = {}
    _in_memory_family[uid][member_id] = family_member

    return family_member


async def get_family_members(uid: str) -> List[Dict[str, Any]]:
    """
    Retrieves all family members for the authenticated user from users/{uid}/familyMembers.
    """
    if not uid:
        return []

    db = get_firestore_client()
    if db:
        try:
            coll_ref = db.collection("users").document(uid).collection("familyMembers")
            docs = coll_ref.stream()
            members = [d.to_dict() for d in docs]
            if members:
                return sorted(members, key=lambda x: x.get("createdAt", ""), reverse=True)
            return []
        except Exception as e:
            logger.warning(f"Firestore get_family_members error: {e}. Falling back to in-memory store.")

    user_store = _in_memory_family.get(uid, {})
    return sorted(list(user_store.values()), key=lambda x: x.get("createdAt", ""), reverse=True)


async def get_family_member(uid: str, member_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves a single family member by ID for the authenticated user.
    """
    if not uid or not member_id:
        return None

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("familyMembers").document(member_id)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.warning(f"Firestore get_family_member error: {e}. Falling back to in-memory store.")

    return _in_memory_family.get(uid, {}).get(member_id)


async def update_family_member(uid: str, member_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Updates an existing family member in users/{uid}/familyMembers/{memberId}.
    """
    if not uid or not member_id:
        return None

    existing = await get_family_member(uid, member_id)
    if not existing:
        return None

    now = datetime.now().isoformat()
    updated_member = {
        **existing,
        **data,
        "id": member_id,
        "userId": uid,  # Preserve UID ownership
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("familyMembers").document(member_id)
            doc_ref.set(updated_member, merge=True)
            logger.info(f"Updated Firestore family member users/{uid}/familyMembers/{member_id}")
        except Exception as e:
            logger.warning(f"Firestore update_family_member error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_family:
        _in_memory_family[uid] = {}
    _in_memory_family[uid][member_id] = updated_member

    return updated_member


async def delete_family_member(uid: str, member_id: str) -> bool:
    """
    Deletes a family member document from users/{uid}/familyMembers/{memberId}.
    """
    if not uid or not member_id:
        return False

    existing = await get_family_member(uid, member_id)
    if not existing:
        return False

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("familyMembers").document(member_id)
            doc_ref.delete()
            logger.info(f"Deleted Firestore family member users/{uid}/familyMembers/{member_id}")
        except Exception as e:
            logger.warning(f"Firestore delete_family_member error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_family and member_id in _in_memory_family[uid]:
        del _in_memory_family[uid][member_id]

    return True
