"""
Firestore Health Alert & Notification Service for GramCare AI
Manages alerts and notifications in Firestore collection structure:
users/{uid}/alerts/{alertId}

Enforces strict Firebase UID scoping for all read, write, mark-read, and delete operations.
"""
from datetime import datetime
import logging
from typing import Dict, Any, List, Optional
import uuid
from services.firebase_admin import get_firestore_client

logger = logging.getLogger("gramcare.firestore_alerts")

# In-memory store fallback for offline/test environments
_in_memory_alerts: Dict[str, Dict[str, Dict[str, Any]]] = {}


def _new_id(prefix: str = "notif") -> str:
    return f"{prefix}_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:6]}"


async def create_alert(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates a new health alert document under users/{uid}/alerts/{alertId}.
    """
    if not uid:
        raise ValueError("UID is required to create an alert")

    alert_id = data.get("id") or _new_id("notif")
    now = datetime.now().isoformat()

    alert_doc = {
        "id": alert_id,
        "userId": uid,
        "category": data.get("category") or data.get("type") or "health",
        "type": data.get("type") or data.get("category") or "health",
        "title": data.get("title") or "Health Advisory",
        "teluguTitle": data.get("teluguTitle") or None,
        "message": data.get("message") or "",
        "teluguMessage": data.get("teluguMessage") or None,
        "severity": data.get("severity") or "info",
        "isRead": bool(data.get("isRead", False)),
        "actionRoute": data.get("actionRoute") or None,
        "timestamp": data.get("timestamp") or now,
        "createdAt": data.get("createdAt") or now,
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("alerts").document(alert_id)
            doc_ref.set(alert_doc, merge=True)
            logger.info(f"Created Firestore alert users/{uid}/alerts/{alert_id}")
            return alert_doc
        except Exception as e:
            logger.warning(f"Firestore create_alert error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_alerts:
        _in_memory_alerts[uid] = {}
    _in_memory_alerts[uid][alert_id] = alert_doc
    return alert_doc


async def get_alerts(uid: str) -> List[Dict[str, Any]]:
    """
    Fetches all alerts for users/{uid}/alerts sorted by createdAt/timestamp descending.
    """
    if not uid:
        return []

    db = get_firestore_client()
    if db:
        try:
            alerts_ref = db.collection("users").document(uid).collection("alerts")
            docs = alerts_ref.stream()
            results = [d.to_dict() for d in docs]
            results.sort(key=lambda x: x.get("createdAt") or x.get("timestamp") or "", reverse=True)
            return results
        except Exception as e:
            logger.warning(f"Firestore get_alerts error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_alerts:
        alerts_list = list(_in_memory_alerts[uid].values())
        alerts_list.sort(key=lambda x: x.get("createdAt") or x.get("timestamp") or "", reverse=True)
        return alerts_list
    return []


async def get_alert(uid: str, alert_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves single alert users/{uid}/alerts/{alertId}.
    Enforces UID ownership.
    """
    if not uid or not alert_id:
        return None

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("alerts").document(alert_id)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.warning(f"Firestore get_alert error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_alerts:
        return _in_memory_alerts[uid].get(alert_id)
    return None


async def mark_alert_read(uid: str, alert_id: str, is_read: bool = True) -> Optional[Dict[str, Any]]:
    """
    Marks an alert users/{uid}/alerts/{alertId} as read or unread.
    """
    existing = await get_alert(uid, alert_id)
    if not existing:
        return None

    now = datetime.now().isoformat()
    updated = {**existing, "isRead": is_read, "updatedAt": now}

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("alerts").document(alert_id)
            doc_ref.set(updated, merge=True)
            return updated
        except Exception as e:
            logger.warning(f"Firestore mark_alert_read error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_alerts:
        _in_memory_alerts[uid] = {}
    _in_memory_alerts[uid][alert_id] = updated
    return updated


async def delete_alert(uid: str, alert_id: str) -> bool:
    """
    Deletes alert users/{uid}/alerts/{alertId}.
    """
    if not uid or not alert_id:
        return False

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("alerts").document(alert_id)
            if not doc_ref.get().exists:
                return False
            doc_ref.delete()
            return True
        except Exception as e:
            logger.warning(f"Firestore delete_alert error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_alerts and alert_id in _in_memory_alerts[uid]:
        del _in_memory_alerts[uid][alert_id]
        return True
    return False
