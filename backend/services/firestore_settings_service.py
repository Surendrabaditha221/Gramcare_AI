"""
Firestore User Settings Service for GramCare AI
Manages user application settings in Firestore document structure:
users/{uid}/settings/main

Enforces strict Firebase UID security and maintains synchronization with user profile language.
"""
from datetime import datetime
import logging
from typing import Dict, Any, Optional
from services.firebase_admin import get_firestore_client
from services import firestore_user_service

logger = logging.getLogger("gramcare.firestore_settings")

# In-memory fallback for offline/test environments
_in_memory_settings: Dict[str, Dict[str, Any]] = {}


def get_default_settings(uid: str, preferred_language: str = "en") -> Dict[str, Any]:
    """
    Constructs safe default application settings.
    """
    return {
        "userId": uid,
        "theme": "light",
        "language": preferred_language or "en",
        "notifications": {
            "medicineReminders": True,
            "healthAlerts": True,
            "appointmentAlerts": True,
            "smsAlerts": False
        },
        "emergencyContacts": [],
        "updatedAt": datetime.now().isoformat()
    }


async def get_settings(uid: str) -> Dict[str, Any]:
    """
    Fetches settings document users/{uid}/settings/main.
    If not found, initializes safe defaults without overwriting existing profiles.
    """
    if not uid:
        raise ValueError("UID is required to get settings")

    # Fetch user profile to get preferred language if available
    user_profile = await firestore_user_service.get_user_by_uid(uid)
    user_lang = (user_profile.get("preferredLanguage") or user_profile.get("language") if user_profile else "en") or "en"

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("settings").document("main")
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            else:
                # Initialize default settings document
                defaults = get_default_settings(uid, preferred_language=user_lang)
                doc_ref.set(defaults, merge=True)
                logger.info(f"Initialized default Firestore settings users/{uid}/settings/main")
                return defaults
        except Exception as e:
            logger.warning(f"Firestore get_settings error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_settings:
        return _in_memory_settings[uid]

    defaults = get_default_settings(uid, preferred_language=user_lang)
    _in_memory_settings[uid] = defaults
    return defaults


async def create_settings(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates/initializes settings document users/{uid}/settings/main.
    """
    return await update_settings(uid, data)


async def update_settings(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates settings document users/{uid}/settings/main.
    Synchronizes language preference to users/{uid} profile document if changed.
    """
    if not uid:
        raise ValueError("UID is required to update settings")

    existing = await get_settings(uid)
    now = datetime.now().isoformat()

    # Merge nested dictionaries if notifications updated
    merged_notifications = {**existing.get("notifications", {})}
    if "notifications" in data and isinstance(data["notifications"], dict):
        merged_notifications.update(data["notifications"])

    updated_settings = {
        **existing,
        **data,
        "userId": uid,  # Ensure UID ownership is preserved
        "notifications": merged_notifications,
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("settings").document("main")
            doc_ref.set(updated_settings, merge=True)
            logger.info(f"Updated Firestore settings users/{uid}/settings/main")
        except Exception as e:
            logger.warning(f"Firestore update_settings error: {e}. Falling back to in-memory store.")

    _in_memory_settings[uid] = updated_settings

    # Sync language change to users/{uid} profile if language updated
    if "language" in data and data["language"]:
        new_lang = data["language"]
        try:
            await firestore_user_service.update_user(uid, {
                "language": new_lang,
                "preferredLanguage": new_lang
            })
        except Exception as e:
            logger.warning(f"Failed to sync language to user profile: {e}")

    return updated_settings
