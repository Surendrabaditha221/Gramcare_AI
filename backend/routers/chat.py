"""
GramCare AI Health Companion Chat Router
"""
from typing import Optional
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from schemas import ChatRequest, ChatResponse
from services.gemini_service import GeminiService
from database import crud

router = APIRouter()

@router.post("/chat", response_model=ChatResponse, summary="GramCare AI Health Companion Chat")
async def chat_companion(request: ChatRequest):
    """
    Supports English and Telugu health guidance queries.
    Escalates emergency / red-flag symptoms instead of attempting diagnosis.
    """
    result = await GeminiService.chat_companion(
        message=request.message,
        patient_name=request.patient_name,
        language=request.language or "en",
        history=request.history,
        patient_context=request.patient_context
    )

    # Persist chat interaction in MongoDB
    user_id = request.patient_context.get("userId") if request.patient_context else "user_primary"
    await crud.save_chat_message(user_id, {
        "sender": "user",
        "text": request.message,
        "patientName": request.patient_name
    })
    await crud.save_chat_message(user_id, {
        "sender": "assistant",
        "text": result.get("reply"),
        "teluguText": result.get("teluguReply"),
        "patientName": request.patient_name
    })

    return ChatResponse(**result)

@router.post("/chat/stream", summary="GramCare AI Real-Time Streaming Chat Response")
async def chat_companion_stream(request: ChatRequest):
    """
    Progressively streams AI health companion response chunks and persists interaction to MongoDB.
    """
    user_id = request.patient_context.get("userId") if request.patient_context else "user_primary"
    await crud.save_chat_message(user_id, {
        "sender": "user",
        "text": request.message,
        "patientName": request.patient_name
    })

    async def streaming_wrapper():
        full_text = ""
        async for chunk in GeminiService.chat_companion_stream(
            message=request.message,
            patient_name=request.patient_name,
            language=request.language or "en",
            history=request.history,
            patient_context=request.patient_context
        ):
            full_text += chunk
            yield chunk

        # Save complete streamed response turn to MongoDB
        await crud.save_chat_message(user_id, {
            "sender": "assistant",
            "text": full_text,
            "patientName": request.patient_name
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

@router.get("/chat/history", summary="Get Chat History from MongoDB")
async def get_chat_history(
    user_id: Optional[str] = Query(None, alias="userId"),
    patient_name: Optional[str] = Query(None, alias="patientName")
):
    """
    Retrieve previous chat conversation history from MongoDB.
    """
    history = await crud.get_chat_history(user_id or "", patient_name)
    return {"history": history}

@router.delete("/chat/history/{message_id}", summary="Delete Chat Message from MongoDB")
async def delete_chat_message(message_id: str):
    """
    Delete single chat message or clear session by ID.
    """
    success = await crud.delete_chat_message(message_id)
    return {"success": success}

