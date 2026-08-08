"""
Pydantic Schemas for Health Companion Chat API
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class ChatRequest(BaseModel):
    message: str = Field(..., description="User question or health concern text")
    patient_name: Optional[str] = Field(default="Primary User", description="Name of the patient being asked about")
    language: Optional[str] = Field(default="en", description="en | te | hi")
    history: Optional[List[Dict[str, Any]]] = Field(default=None, description="Past conversation history turns")
    patient_context: Optional[Dict[str, Any]] = Field(default=None, description="Clinical context (age, gender, relation, allergies, conditions, medications)")


class ChatResponse(BaseModel):
    reply: str
    teluguReply: Optional[str] = None
    hindiReply: Optional[str] = None
    intent: Optional[str] = "HEALTH_QUERY"
    isEmergency: bool = False
    disclaimer: str
