"""
Pydantic Schemas for Document Analysis API
"""
from pydantic import BaseModel, Field
from typing import List, Optional

class DocumentAnalyzeRequest(BaseModel):
    doc_type: str = Field(..., description="Prescription | Medical Report | Health Record")
    patient_name: str = Field(..., description="Patient Name")
    raw_text: Optional[str] = Field(default=None, description="Optional raw document text/OCR content")

class DocumentAnalyzeResponse(BaseModel):
    doc_type: str
    extracted_patient_name: str
    doctor_or_lab_name: str
    date: str
    key_findings: List[str]
    medications_mentioned: List[str]
    follow_up_instructions: str
