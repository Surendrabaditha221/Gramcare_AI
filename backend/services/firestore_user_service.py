"""
Firestore User Service for GramCare AI
Handles user profile persistence exclusively in Firestore collection `users/{uid}`.
Uses Firebase Authentication UID as document key.
"""
from datetime import datetime
import logging
from typing import Dict, Any, Optional
from services.firebase_admin import get_firestore_client

logger = logging.getLogger("gramcare.firestore_users")

# In-memory store fallback for offline/test environments when local service account is unconfigured
_in_memory_firestore_users: Dict[str, Dict[str, Any]] = {}


def _clean_user_doc(uid: str, doc_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures consistent document structure for users/{uid}."""
    cleaned = dict(doc_dict)
    cleaned["uid"] = uid
    cleaned["id"] = uid
    cleaned["userId"] = uid

    now = datetime.now().isoformat()
    cleaned["createdAt"] = cleaned.get("createdAt") or now
    cleaned["updatedAt"] = cleaned.get("updatedAt") or now
    cleaned["lastLogin"] = cleaned.get("lastLogin") or now

    cleaned["profileCompleted"] = bool(cleaned.get("profileCompleted") or cleaned.get("isProfileCompleted"))
    cleaned["onboardingCompleted"] = bool(cleaned.get("onboardingCompleted") or cleaned.get("isOnboardingCompleted"))
    cleaned["preferredLanguage"] = cleaned.get("preferredLanguage") or cleaned.get("language") or "en"

    return cleaned


async def get_user_by_uid(uid: str) -> Optional[Dict[str, Any]]:
    """
    Fetches user document from Firestore collection `users/{uid}`.
    """
    if not uid or not isinstance(uid, str):
        return None

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid)
            doc = doc_ref.get()
            if doc.exists:
                return _clean_user_doc(uid, doc.to_dict())
            return None
        except Exception as e:
            logger.warning(f"Firestore get_user_by_uid error: {e}. Checking in-memory fallback.")

    if uid in _in_memory_firestore_users:
        return _clean_user_doc(uid, _in_memory_firestore_users[uid])
    return None


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Fetches user document from Firestore collection `users` by email query.
    """
    if not email or not isinstance(email, str):
        return None

    email_clean = email.strip().lower()

    db = get_firestore_client()
    if db:
        try:
            users_ref = db.collection("users")
            query = users_ref.where("email", "==", email_clean).limit(1)
            docs = query.stream()
            for doc in docs:
                data = doc.to_dict()
                return _clean_user_doc(doc.id, data)
        except Exception as e:
            logger.warning(f"Firestore get_user_by_email error: {e}. Checking in-memory fallback.")

    for uid, user_data in _in_memory_firestore_users.items():
        if (user_data.get("email") or "").strip().lower() == email_clean:
            return _clean_user_doc(uid, user_data)
    return None


async def delete_user(uid: str) -> bool:
    """
    Deletes user document from Firestore collection `users/{uid}`.
    """
    if not uid:
        return False

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid)
            doc_ref.delete()
            logger.info(f"Deleted Firestore user users/{uid}")
        except Exception as e:
            logger.warning(f"Firestore delete_user error: {e}. Removing from in-memory fallback.")

    if uid in _in_memory_firestore_users:
        del _in_memory_firestore_users[uid]
    return True


async def create_user(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates user document in Firestore collection `users/{uid}`.
    Does NOT allow overwriting existing document under different UID.
    """
    now = datetime.now().isoformat()
    user_doc = {
        "uid": uid,
        "id": uid,
        "userId": uid,
        "email": data.get("email") or None,
        "displayName": data.get("displayName") or data.get("fullName") or None,
        "photoURL": data.get("photoURL") or data.get("profileImage") or None,
        "createdAt": data.get("createdAt") or now,
        "updatedAt": now,
        "lastLogin": now,
        "profileCompleted": bool(data.get("profileCompleted", False)),
        "onboardingCompleted": bool(data.get("onboardingCompleted", False)),
        "preferredLanguage": data.get("preferredLanguage") or data.get("language") or "en",
        "healthProfile": data.get("healthProfile") or {}
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid)
            doc_ref.set(user_doc, merge=True)
            logger.info(f"Created/updated Firestore document users/{uid}")
            return _clean_user_doc(uid, user_doc)
        except Exception as e:
            logger.warning(f"Firestore create_user error: {e}. Saving to in-memory fallback.")

    _in_memory_firestore_users[uid] = user_doc
    return _clean_user_doc(uid, user_doc)


async def update_user(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates user document in Firestore collection `users/{uid}`.
    """
    existing = await get_user_by_uid(uid)
    now = datetime.now().isoformat()

    updates = dict(data)
    updates["uid"] = uid
    updates["updatedAt"] = now

    if existing:
        merged = {**existing, **updates}
    else:
        merged = {
            "uid": uid,
            "id": uid,
            "userId": uid,
            "email": updates.get("email"),
            "displayName": updates.get("displayName"),
            "photoURL": updates.get("photoURL"),
            "createdAt": now,
            "updatedAt": now,
            "lastLogin": now,
            "profileCompleted": False,
            "onboardingCompleted": False,
            "preferredLanguage": "en",
            **updates
        }

    merged = _clean_user_doc(uid, merged)

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid)
            doc_ref.set(merged, merge=True)
            logger.info(f"Updated Firestore document users/{uid}")
            return merged
        except Exception as e:
            logger.warning(f"Firestore update_user error: {e}. Saving to in-memory fallback.")

    _in_memory_firestore_users[uid] = merged
    return merged


async def get_user_profile(uid: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves user profile from Firestore collection `users/{uid}`.
    """
    return await get_user_by_uid(uid)


async def update_user_profile(uid: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates profile fields in Firestore collection `users/{uid}` and sets profileCompleted=True.
    """
    updates = dict(profile_data)
    updates["profileCompleted"] = True
    updates["onboardingCompleted"] = True
    updates["updatedAt"] = datetime.now().isoformat()

    return await update_user(uid, updates)
