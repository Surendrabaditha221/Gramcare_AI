"""
GramCare AI Health Companion Chat Router
Persists all conversations and messages in Firestore collection structure:
users/{uid}/conversations/{conversationId}/messages/{messageId}

Strictly scopes all operations to the authenticated user's Firebase UID.
"""
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Query, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from schemas import ChatRequest, ChatResponse
from services.gemini_service import GeminiService
from services import firestore_chat_service, firestore_family_service, firestore_user_service
from routers.auth import get_current_user_from_token

router = APIRouter(prefix="/chat", tags=["Chat"])


async def _resolve_patient_context(uid: str, current_user: Dict[str, Any], patient_name: Optional[str], patient_context: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Resolves real patient context strictly from Firestore and request data without fabrication."""
    if patient_context:
        return patient_context

    # Check if patient matches a family member in Firestore
    if patient_name and patient_name.strip():
        fam_members = await firestore_family_service.get_family_members(uid)
        for fam in fam_members:
            if (fam.get("fullName") or "").strip().lower() == patient_name.strip().lower():
                ctx = {
                    "name": fam.get("fullName"),
                    "relation": fam.get("relation"),
                }
                if fam.get("age"):
                    ctx["age"] = fam.get("age")
                if fam.get("gender"):
                    ctx["gender"] = fam.get("gender")
                if fam.get("knownAllergies"):
                    ctx["knownAllergies"] = fam.get("knownAllergies")
                if fam.get("medicalConditions"):
                    ctx["medicalConditions"] = fam.get("medicalConditions")
                if fam.get("currentMedications"):
                    ctx["currentMedications"] = fam.get("currentMedications")
                return ctx

    # Default to authenticated user's own profile
    user_name = current_user.get("displayName") or current_user.get("fullName") or "Patient"
    ctx = {
        "name": user_name,
        "relation": "Self (Account Holder)"
    }
    if current_user.get("age"):
        ctx["age"] = current_user.get("age")
    if current_user.get("gender"):
        ctx["gender"] = current_user.get("gender")
    if current_user.get("knownAllergies"):
        ctx["knownAllergies"] = current_user.get("knownAllergies")
    if current_user.get("medicalConditions"):
        ctx["medicalConditions"] = current_user.get("medicalConditions")
    if current_user.get("currentMedications"):
        ctx["currentMedications"] = current_user.get("currentMedications")
    return ctx


@router.post("", response_model=ChatResponse, summary="GramCare AI Health Companion Chat")
async def chat_companion(
    request: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Supports English and regional health guidance queries.
    Persists interaction to Firestore users/{uid}/conversations/{conversationId}/messages.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    conversation_id = request.conversation_id or "conv_default"

    # Save user message to Firestore
    await firestore_chat_service.save_message(uid, conversation_id, {
        "role": "user",
        "content": request.message,
        "patientName": request.patient_name
    })

    # Resolve context and history
    patient_ctx = await _resolve_patient_context(uid, current_user, request.patient_name, request.patient_context)
    
    # Retrieve sliding context history if not provided
    history_payload = request.history
    if not history_payload:
        stored_msgs = await firestore_chat_service.get_messages(uid, conversation_id)
        # Exclude the message just saved from history to avoid duplication with request.message
        history_payload = [
            {"sender": m.get("role") or m.get("sender"), "text": m.get("content") or m.get("text")}
            for m in stored_msgs[:-1]
        ][-10:]

    target_lang = request.language or current_user.get("preferredLanguage") or current_user.get("language") or "en"

    result = await GeminiService.chat_companion(
        message=request.message,
        patient_name=request.patient_name or patient_ctx.get("name"),
        language=target_lang,
        history=history_payload,
        patient_context=patient_ctx
    )

    # Save assistant response to Firestore
    await firestore_chat_service.save_message(uid, conversation_id, {
        "role": "assistant",
        "content": result.get("reply", ""),
        "teluguText": result.get("teluguReply"),
        "patientName": request.patient_name or patient_ctx.get("name")
    })

    return ChatResponse(**result)


@router.post("/stream", summary="GramCare AI Real-Time Streaming Chat Response")
async def chat_companion_stream(
    request: ChatRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Progressively streams AI health companion response chunks and persists interaction to Firestore.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    conversation_id = request.conversation_id or "conv_default"

    # Save user message to Firestore
    await firestore_chat_service.save_message(uid, conversation_id, {
        "role": "user",
        "content": request.message,
        "patientName": request.patient_name
    })

    # Resolve context and history
    patient_ctx = await _resolve_patient_context(uid, current_user, request.patient_name, request.patient_context)

    history_payload = request.history
    if not history_payload:
        stored_msgs = await firestore_chat_service.get_messages(uid, conversation_id)
        history_payload = [
            {"sender": m.get("role") or m.get("sender"), "text": m.get("content") or m.get("text")}
            for m in stored_msgs[:-1]
        ][-10:]

    target_lang = request.language or current_user.get("preferredLanguage") or current_user.get("language") or "en"

    async def streaming_wrapper():
        full_text = ""
        async for chunk in GeminiService.chat_companion_stream(
            message=request.message,
            patient_name=request.patient_name or patient_ctx.get("name"),
            language=target_lang,
            history=history_payload,
            patient_context=patient_ctx
        ):
            full_text += chunk
            yield chunk

        # Save assistant response turn to Firestore once streaming finishes cleanly
        if full_text.strip():
            await firestore_chat_service.save_message(uid, conversation_id, {
                "role": "assistant",
                "content": full_text,
                "patientName": request.patient_name or patient_ctx.get("name")
            })

    return StreamingResponse(
        streaming_wrapper(),
        media_type="text/plain; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )


@router.get("/conversations", summary="List Authenticated User Conversations")
async def list_conversations(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Retrieves all conversation threads for users/{uid}/conversations.
    Returns empty list if user has no conversations (no demo data).
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    conversations = await firestore_chat_service.get_conversations(uid)
    return {"conversations": conversations}


@router.get("/conversations/{conversation_id}/messages", summary="Get Conversation Messages")
async def get_conversation_messages(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Retrieves message history for users/{uid}/conversations/{conversationId}/messages.
    Strictly verifies that conversation belongs to authenticated UID.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    conv = await firestore_chat_service.get_conversation(uid, conversation_id)
    if not conv:
        raise HTTPException(status_code=403, detail="Access denied: Conversation not found or belongs to another user")

    messages = await firestore_chat_service.get_messages(uid, conversation_id)
    return {"messages": messages, "conversation": conv}


@router.get("/history", summary="Get Chat History from Firestore")
async def get_chat_history(
    conversation_id: Optional[str] = Query("conv_default", alias="conversationId"),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Retrieves chat message history for the authenticated user from Firestore.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    conv_id = conversation_id or "conv_default"
    messages = await firestore_chat_service.get_messages(uid, conv_id)
    return {"history": messages}


@router.delete("/conversations/{conversation_id}", summary="Delete Conversation Thread")
async def delete_conversation_thread(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Deletes conversation and subcollection messages for users/{uid}/conversations/{conversationId}.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    success = await firestore_chat_service.delete_conversation(uid, conversation_id)
    if not success:
        raise HTTPException(status_code=404, detail="Conversation not found or access denied")
    return {"success": True, "message": "Conversation deleted successfully"}


@router.delete("/history/{message_id}", summary="Delete Chat Message from Firestore")
async def delete_chat_message(
    message_id: str,
    conversation_id: Optional[str] = Query("conv_default", alias="conversationId"),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Deletes single message from users/{uid}/conversations/{conversationId}/messages/{messageId}.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    conv_id = conversation_id or "conv_default"
    success = await firestore_chat_service.delete_message(uid, conv_id, message_id)
    return {"success": success}


