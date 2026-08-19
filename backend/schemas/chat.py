"""
Pydantic Schemas for Health Companion Chat API
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=3000, description="User question or health concern text")
    patient_name: Optional[str] = Field(default="Primary User", max_length=100, description="Name of the patient being asked about")
    language: Optional[str] = Field(default="en", max_length=10, description="en | te | hi | ta | kn | ml")
    user_id: Optional[str] = Field(default=None, description="Authenticated user ID")
    conversation_id: Optional[str] = Field(default=None, description="Firestore conversation document ID")
    history: Optional[List[Dict[str, Any]]] = Field(default=None, description="Past conversation history turns")
    patient_context: Optional[Dict[str, Any]] = Field(default=None, description="Clinical context (age, gender, relation, allergies, conditions, medications)")


class ChatResponse(BaseModel):
    reply: str
    teluguReply: Optional[str] = None
    hindiReply: Optional[str] = None
    intent: Optional[str] = "HEALTH_QUERY"
    isEmergency: bool = False
    sources: Optional[List[Dict[str, Any]]] = None
    disclaimer: str
