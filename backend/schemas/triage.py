"""
Pydantic Schemas for Symptom Triage Evaluation API
"""
from pydantic import BaseModel, Field
from typing import List, Optional

class TriageRequest(BaseModel):
    patient: Optional[str] = Field(default="Primary User", description="Patient name or ID")
    patient_id: Optional[str] = Field(default=None, description="Patient unique ID")
    user_id: Optional[str] = Field(default=None, description="Logged in user unique ID")
    age_group: Optional[str] = Field(default="adult", description="child | adult | elderly | pregnant")
    main_complaint: str = Field(..., description="Main symptoms or chief health concern")
    symptom_duration: str = Field(..., description="Duration e.g. today, 2 days, 1 week")
    severity: str = Field(..., description="Mild | Moderate | Severe")
    related_symptoms: List[str] = Field(default_factory=list, description="List of related selected symptoms")
    warning_signs: List[str] = Field(default_factory=list, description="List of warning signs or red flags")
    additional_details: Optional[str] = Field(default=None, description="Any extra context")

class TriageResponse(BaseModel):
    urgency_level: str
    severity_code: str
    title_en: str
    title_te: str
    summary_en: str
    summary_te: str
    recommended_next_actions_en: List[str]
    recommended_next_actions_te: List[str]
    warning_information_en: List[str]
    warning_information_te: List[str]
    nearby_care_recommendation: str
    disclaimer: str
