"""
MongoDB CRUD Helpers for GramCare AI
All data operations go through here.
- If MongoDB is connected  → reads/writes go to Atlas (persistent)
- If MongoDB is offline    → falls back to MemoryDataStore (temporary)
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

import database.mongo as mongo
from services.data_store import memory_store


# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────

def _new_id(prefix: str) -> str:
    return f"{prefix}_{int(datetime.now().timestamp() * 1000)}"


def _serialize(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert MongoDB _id to string 'id' field."""
    if doc is None:
        return doc
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc.pop("_id"))
    return doc


# ─────────────────────────────────────────────
# Patients
# ─────────────────────────────────────────────

async def get_patients(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if mongo.is_mongo_connected and mongo.db is not None:
        query = {"userId": user_id} if user_id else {}
        cursor = mongo.db["patients"].find(query)
        docs = await cursor.to_list(length=1000)
        return [_serialize(d) for d in docs]
    return memory_store.get_patients()


async def get_patient_by_id(patient_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if mongo.is_mongo_connected and mongo.db is not None:
        query = {"id": patient_id}
        if user_id:
            query["userId"] = user_id
        doc = await mongo.db["patients"].find_one(query)
        return _serialize(doc) if doc else None
    return memory_store.get_patient_by_id(patient_id)


async def upsert_patient(patient: Dict[str, Any]) -> Dict[str, Any]:
    if not patient.get("id"):
        patient["id"] = _new_id("pat")

    if mongo.is_mongo_connected and mongo.db is not None:
        await mongo.db["patients"].update_one(
            {"id": patient["id"]},
            {"$set": patient},
            upsert=True,
        )
        return patient

    return memory_store.add_patient(patient)


# ─────────────────────────────────────────────
# Health Records
# ─────────────────────────────────────────────

async def get_records(patient_id: Optional[str] = None, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if mongo.is_mongo_connected and mongo.db is not None:
        query: Dict[str, Any] = {}
        if user_id:
            query["userId"] = user_id
        if patient_id:
            query["patientId"] = patient_id

        cursor = mongo.db["records"].find(query).sort("_id", -1)
        docs = await cursor.to_list(length=1000)
        return [_serialize(d) for d in docs]
    return memory_store.get_records(patient_id=patient_id)


async def add_record(record: Dict[str, Any]) -> Dict[str, Any]:
    if not record.get("id"):
        record["id"] = _new_id("rec")

    if mongo.is_mongo_connected and mongo.db is not None:
        await mongo.db["records"].update_one(
            {"id": record["id"]},
            {"$set": record},
            upsert=True,
        )
        return record

    return memory_store.add_record(record)


# ─────────────────────────────────────────────
# Alerts
# ─────────────────────────────────────────────

async def get_alerts(user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    if mongo.is_mongo_connected and mongo.db is not None:
        query = {"userId": user_id} if user_id else {}
        cursor = mongo.db["alerts"].find(query).sort("_id", -1)
        docs = await cursor.to_list(length=1000)
        return [_serialize(d) for d in docs]
    return memory_store.get_alerts()


async def add_alert(alert: Dict[str, Any]) -> Dict[str, Any]:
    if not alert.get("id"):
        alert["id"] = _new_id("notif")

    if mongo.is_mongo_connected and mongo.db is not None:
        await mongo.db["alerts"].update_one(
            {"id": alert["id"]},
            {"$set": alert},
            upsert=True,
        )
        return alert

    return memory_store.add_alert(alert)


# ─────────────────────────────────────────────
# Triage Logs
# ─────────────────────────────────────────────

async def save_triage_log(log: Dict[str, Any]) -> Dict[str, Any]:
    if not log.get("id"):
        log["id"] = _new_id("triage")
    log["createdAt"] = datetime.now().isoformat()

    if mongo.is_mongo_connected and mongo.db is not None:
        await mongo.db["triage_logs"].insert_one(dict(log))
        return log

    return memory_store.save_triage_log(log)


# ─────────────────────────────────────────────
# User Profile Management
# ─────────────────────────────────────────────

async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    if not email:
        return None
    email_clean = email.strip().lower()
    if mongo.is_mongo_connected and mongo.db is not None:
        doc = await mongo.db["users"].find_one({"email": email_clean})
        if not doc:
            doc = await mongo.db["patients"].find_one({"email": email_clean})
        return _serialize(doc) if doc else None
    return memory_store.users.get(email_clean)


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    if not user_id:
        return None
    if mongo.is_mongo_connected and mongo.db is not None:
        doc = await mongo.db["users"].find_one({"id": user_id})
        if not doc:
            doc = await mongo.db["users"].find_one({"userId": user_id})
        if not doc:
            doc = await mongo.db["patients"].find_one({"userId": user_id})
        return _serialize(doc) if doc else None
    for u in memory_store.users.values():
        if u.get("id") == user_id or u.get("userId") == user_id:
            return u
    return None


async def upsert_user_profile(user_data: Dict[str, Any]) -> Dict[str, Any]:
    target_id = user_data.get("id") or user_data.get("uid") or user_data.get("userId") or _new_id("usr")
    user_data["id"] = target_id
    user_data["userId"] = target_id

    if user_data.get("email"):
        user_data["email"] = user_data["email"].strip().lower()

    user_data["isOnboardingCompleted"] = True
    user_data["updatedAt"] = datetime.now().isoformat()

    if mongo.is_mongo_connected and mongo.db is not None:
        await mongo.db["users"].update_one(
            {"id": target_id},
            {"$set": user_data},
            upsert=True,
        )

        primary_patient_id = f"pat_primary_{target_id}"
        patient_record = {
            "id": primary_patient_id,
            "userId": target_id,
            "fullName": user_data.get("fullName", "Primary User"),
            "email": user_data.get("email"),
            "relation": "Self",
            "age": user_data.get("age"),
            "gender": user_data.get("gender", "male"),
            "bloodGroup": user_data.get("bloodGroup"),
            "phone": user_data.get("phone"),
            "emergencyContactPhone": user_data.get("emergencyContactPhone"),
            "knownAllergies": user_data.get("knownAllergies"),
            "medicalConditions": user_data.get("medicalConditions"),
            "currentMedications": user_data.get("currentMedications"),
            "village": user_data.get("village"),
            "district": user_data.get("district"),
            "state": user_data.get("state"),
            "preferredLanguage": user_data.get("preferredLanguage", "en")
        }
        await mongo.db["patients"].update_one(
            {"id": primary_patient_id},
            {"$set": patient_record},
            upsert=True
        )
        return user_data

    if user_data.get("email"):
        memory_store.users[user_data["email"]] = user_data
    return user_data


# ─────────────────────────────────────────────
# Chat History Persistence
# ─────────────────────────────────────────────

async def save_chat_message(user_id: str, message_data: Dict[str, Any]) -> Dict[str, Any]:
    msg = dict(message_data)
    if not msg.get("id"):
        msg["id"] = _new_id("chat")
    msg["userId"] = user_id or "user_primary"
    msg["createdAt"] = datetime.now().isoformat()

    if mongo.is_mongo_connected and mongo.db is not None:
        await mongo.db["chat_messages"].insert_one(dict(msg))
        return _serialize(msg)

    memory_store.chat_history.append(msg)
    return msg


async def get_chat_history(user_id: str, patient_name: Optional[str] = None) -> List[Dict[str, Any]]:
    if mongo.is_mongo_connected and mongo.db is not None:
        query: Dict[str, Any] = {}
        if user_id:
            query["userId"] = user_id
            if patient_name:
                query["patientName"] = patient_name
        elif patient_name:
            query["patientName"] = patient_name

        cursor = mongo.db["chat_messages"].find(query).sort("_id", 1)
        docs = await cursor.to_list(length=1000)
        return [_serialize(d) for d in docs]

    if user_id:
        return [
            m for m in memory_store.chat_history
            if m.get("userId") == user_id and (not patient_name or m.get("patientName") == patient_name)
        ]
    return memory_store.chat_history


async def delete_chat_message(message_id: str) -> bool:
    if mongo.is_mongo_connected and mongo.db is not None:
        res = await mongo.db["chat_messages"].delete_one({"id": message_id})
        return res.deleted_count > 0

    initial_len = len(memory_store.chat_history)
    memory_store.chat_history = [m for m in memory_store.chat_history if m.get("id") != message_id]
    return len(memory_store.chat_history) < initial_len
