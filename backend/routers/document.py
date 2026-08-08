"""
Medical Document & Prescription Analysis Router
"""
from fastapi import APIRouter
from schemas import DocumentAnalyzeRequest, DocumentAnalyzeResponse
from services.gemini_service import GeminiService

router = APIRouter()

@router.post("/document/analyze", response_model=DocumentAnalyzeResponse, summary="Analyze Prescription or Lab Report")
async def analyze_document(request: DocumentAnalyzeRequest):
    """
    Extracts structured medical findings, medications mentioned, and follow-up instructions from uploaded documents.
    """
    result = await GeminiService.analyze_document(
        doc_type=request.doc_type,
        patient_name=request.patient_name,
        raw_text=request.raw_text
    )
    return DocumentAnalyzeResponse(**result)
