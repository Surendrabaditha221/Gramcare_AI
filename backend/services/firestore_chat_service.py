"""
Firestore Chat Service for GramCare AI
Manages chat conversations and message history in Firestore collection structure:
users/{uid}/conversations/{conversationId}/messages/{messageId}

Enforces strict UID scoping for all read and write operations.
"""
from datetime import datetime
import logging
from typing import Dict, Any, List, Optional
import uuid
from services.firebase_admin import get_firestore_client

logger = logging.getLogger("gramcare.firestore_chat")

# In-memory store fallback for offline/test environments
_in_memory_conversations: Dict[str, Dict[str, Dict[str, Any]]] = {}
_in_memory_messages: Dict[str, Dict[str, List[Dict[str, Any]]]] = {}


def _new_id(prefix: str) -> str:
    return f"{prefix}_{int(datetime.now().timestamp() * 1000)}_{uuid.uuid4().hex[:6]}"


async def create_conversation(uid: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Creates a conversation document under users/{uid}/conversations/{conversationId}.
    """
    if not uid:
        raise ValueError("UID is required to create a conversation")

    conv_id = data.get("id") or _new_id("conv")
    now = datetime.now().isoformat()
    conv_doc = {
        "id": conv_id,
        "title": data.get("title") or "Health Consultation",
        "patientName": data.get("patientName") or "Primary User",
        "createdAt": data.get("createdAt") or now,
        "updatedAt": now
    }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("conversations").document(conv_id)
            doc_ref.set(conv_doc, merge=True)
            logger.info(f"Created Firestore conversation users/{uid}/conversations/{conv_id}")
            return conv_doc
        except Exception as e:
            logger.warning(f"Firestore create_conversation error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_conversations:
        _in_memory_conversations[uid] = {}
    _in_memory_conversations[uid][conv_id] = conv_doc
    return conv_doc


async def get_conversations(uid: str) -> List[Dict[str, Any]]:
    """
    Fetches all conversations for users/{uid}/conversations sorted by updatedAt descending.
    """
    if not uid:
        return []

    db = get_firestore_client()
    if db:
        try:
            convs_ref = db.collection("users").document(uid).collection("conversations")
            docs = convs_ref.order_by("updatedAt", direction="DESCENDING").stream()
            results = [d.to_dict() for d in docs]
            return results
        except Exception as e:
            logger.warning(f"Firestore get_conversations error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_conversations:
        conv_list = list(_in_memory_conversations[uid].values())
        conv_list.sort(key=lambda x: x.get("updatedAt", ""), reverse=True)
        return conv_list
    return []


async def get_conversation(uid: str, conversation_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves single conversation users/{uid}/conversations/{conversationId}.
    Enforces that conversation belongs to the requested UID.
    """
    if not uid or not conversation_id:
        return None

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("conversations").document(conversation_id)
            doc = doc_ref.get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.warning(f"Firestore get_conversation error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_conversations:
        return _in_memory_conversations[uid].get(conversation_id)
    return None


async def update_conversation(uid: str, conversation_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Updates conversation users/{uid}/conversations/{conversationId}.
    """
    existing = await get_conversation(uid, conversation_id)
    now = datetime.now().isoformat()

    updates = dict(data)
    updates["id"] = conversation_id
    updates["updatedAt"] = now

    if existing:
        merged = {**existing, **updates}
    else:
        merged = {
            "id": conversation_id,
            "title": updates.get("title", "Health Consultation"),
            "patientName": updates.get("patientName", "Primary User"),
            "createdAt": now,
            "updatedAt": now,
            **updates
        }

    db = get_firestore_client()
    if db:
        try:
            doc_ref = db.collection("users").document(uid).collection("conversations").document(conversation_id)
            doc_ref.set(merged, merge=True)
            return merged
        except Exception as e:
            logger.warning(f"Firestore update_conversation error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_conversations:
        _in_memory_conversations[uid] = {}
    _in_memory_conversations[uid][conversation_id] = merged
    return merged


async def delete_conversation(uid: str, conversation_id: str) -> bool:
    """
    Deletes conversation users/{uid}/conversations/{conversationId} and its messages.
    """
    if not uid or not conversation_id:
        return False

    db = get_firestore_client()
    if db:
        try:
            conv_ref = db.collection("users").document(uid).collection("conversations").document(conversation_id)
            # Delete all subcollection messages first
            messages_ref = conv_ref.collection("messages").stream()
            for msg_doc in messages_ref:
                msg_doc.reference.delete()

            if conv_ref.get().exists:
                conv_ref.delete()
        except Exception as e:
            logger.warning(f"Firestore delete_conversation error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_conversations and conversation_id in _in_memory_conversations[uid]:
        del _in_memory_conversations[uid][conversation_id]
    if uid in _in_memory_messages and conversation_id in _in_memory_messages[uid]:
        del _in_memory_messages[uid][conversation_id]

    return True


async def save_message(uid: str, conversation_id: str, message: Dict[str, Any]) -> Dict[str, Any]:
    """
    Saves a message to users/{uid}/conversations/{conversationId}/messages/{messageId}.
    """
    if not uid or not conversation_id:
        raise ValueError("UID and conversationId are required to save message")

    # Ensure conversation exists
    conv = await get_conversation(uid, conversation_id)
    now = datetime.now().isoformat()

    msg_id = message.get("id") or _new_id("msg")
    role = message.get("role") or (
        "user" if message.get("sender") == "user" else "assistant"
    )

    content_text = message.get("content") or message.get("text") or ""

    msg_doc = {
        "id": msg_id,
        "role": role,
        "sender": role,
        "content": content_text,
        "text": content_text,
        "teluguText": message.get("teluguText") or None,
        "patientName": message.get("patientName") or (conv.get("patientName") if conv else "Primary User"),
        "createdAt": message.get("createdAt") or now
    }

    # Update conversation title if first message
    new_title = conv.get("title") if conv else "Health Consultation"
    if role == "user" and (not conv or conv.get("title") == "Health Consultation"):
        new_title = content_text[:35].strip() + ("..." if len(content_text) > 35 else "")

    await update_conversation(uid, conversation_id, {"title": new_title, "updatedAt": now})

    db = get_firestore_client()
    if db:
        try:
            msg_ref = (
                db.collection("users")
                .document(uid)
                .collection("conversations")
                .document(conversation_id)
                .collection("messages")
                .document(msg_id)
            )
            msg_ref.set(msg_doc, merge=True)
            logger.info(f"Saved message {msg_id} to users/{uid}/conversations/{conversation_id}/messages")
            return msg_doc
        except Exception as e:
            logger.warning(f"Firestore save_message error: {e}. Falling back to in-memory store.")

    if uid not in _in_memory_messages:
        _in_memory_messages[uid] = {}
    if conversation_id not in _in_memory_messages[uid]:
        _in_memory_messages[uid][conversation_id] = []
    
    _in_memory_messages[uid][conversation_id].append(msg_doc)
    return msg_doc


async def get_messages(uid: str, conversation_id: str) -> List[Dict[str, Any]]:
    """
    Fetches messages for users/{uid}/conversations/{conversationId}/messages sorted by createdAt ascending.
    Strictly scoped to the verified UID.
    """
    if not uid or not conversation_id:
        return []

    # Verify conversation belongs to UID
    conv = await get_conversation(uid, conversation_id)
    if not conv:
        return []

    db = get_firestore_client()
    if db:
        try:
            msgs_ref = (
                db.collection("users")
                .document(uid)
                .collection("conversations")
                .document(conversation_id)
                .collection("messages")
            )
            docs = msgs_ref.order_by("createdAt", direction="ASCENDING").stream()
            results = [d.to_dict() for d in docs]
            return results
        except Exception as e:
            logger.warning(f"Firestore get_messages error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_messages and conversation_id in _in_memory_messages[uid]:
        msg_list = list(_in_memory_messages[uid][conversation_id])
        msg_list.sort(key=lambda x: x.get("createdAt", ""))
        return msg_list
    return []


async def delete_message(uid: str, conversation_id: str, message_id: str) -> bool:
    """
    Deletes single message from users/{uid}/conversations/{conversationId}/messages/{messageId}.
    """
    if not uid or not conversation_id or not message_id:
        return False

    db = get_firestore_client()
    if db:
        try:
            msg_ref = (
                db.collection("users")
                .document(uid)
                .collection("conversations")
                .document(conversation_id)
                .collection("messages")
                .document(message_id)
            )
            if msg_ref.get().exists:
                msg_ref.delete()
                return True
            return False
        except Exception as e:
            logger.warning(f"Firestore delete_message error: {e}. Falling back to in-memory store.")

    if uid in _in_memory_messages and conversation_id in _in_memory_messages[uid]:
        initial_len = len(_in_memory_messages[uid][conversation_id])
        _in_memory_messages[uid][conversation_id] = [
            m for m in _in_memory_messages[uid][conversation_id] if m.get("id") != message_id
        ]
        return len(_in_memory_messages[uid][conversation_id]) < initial_len
    return False
