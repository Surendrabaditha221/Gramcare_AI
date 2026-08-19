"""
Pydantic Schemas for Symptom Triage Evaluation API & Triage Logs
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Any

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
    isEmergency: Optional[bool] = False
    riskLevel: Optional[str] = "low"
    redFlags: Optional[List[str]] = Field(default_factory=list)
    emergencyContacts: Optional[Any] = None

class TriageLogCreate(BaseModel):
    id: Optional[str] = None
    patientId: Optional[str] = "user_primary"
    patientName: Optional[str] = None
    mainComplaint: Optional[str] = ""
    symptoms: List[str] = Field(default_factory=list)
    duration: Optional[str] = None
    severity: Optional[str] = None
    possibleConditions: List[str] = Field(default_factory=list)
    riskLevel: Optional[str] = "low"
    urgencyLevel: Optional[str] = None
    aiAssessment: Optional[str] = None
    recommendation: Optional[str] = None
    recommendedNextActions: List[str] = Field(default_factory=list)
    warningSigns: List[str] = Field(default_factory=list)
    ageGroup: Optional[str] = "adult"
    additionalDetails: Optional[str] = None
    disclaimer: Optional[str] = None

class TriageLogResponse(BaseModel):
    id: str
    userId: str
    patientId: Optional[str] = "user_primary"
    patientName: Optional[str] = None
    mainComplaint: Optional[str] = ""
    symptoms: List[str] = Field(default_factory=list)
    duration: Optional[str] = None
    severity: Optional[str] = None
    possibleConditions: List[str] = Field(default_factory=list)
    riskLevel: Optional[str] = "low"
    urgencyLevel: Optional[str] = None
    aiAssessment: Optional[str] = None
    recommendation: Optional[str] = None
    recommendedNextActions: List[str] = Field(default_factory=list)
    warningSigns: List[str] = Field(default_factory=list)
    ageGroup: Optional[str] = "adult"
    additionalDetails: Optional[str] = None
    disclaimer: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
