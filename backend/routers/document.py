"""
Medical Document & Prescription Analysis Router
Supports both text-based analysis and image/PDF file uploads with Gemini Vision OCR.
"""
import os
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, status
from fastapi.responses import JSONResponse
from schemas import DocumentAnalyzeRequest, DocumentAnalyzeResponse
from services.gemini_service import GeminiService

logger = logging.getLogger("gramcare.document")
router = APIRouter()

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB


def _validate_upload(file: UploadFile) -> str:
    """Validates upload and returns the file extension. Raises HTTPException on failure."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported file type '{ext}'. Allowed: JPG, PNG, WEBP, PDF"
        )
    return ext


@router.post(
    "/document/analyze",
    response_model=DocumentAnalyzeResponse,
    summary="Analyze Prescription or Lab Report (text input)"
)
async def analyze_document(request: DocumentAnalyzeRequest):
    """
    Extracts structured medical findings from raw document text via Gemini AI.
    """
    result = await GeminiService.analyze_document(
        doc_type=request.doc_type,
        patient_name=request.patient_name,
        raw_text=request.raw_text
    )
    return DocumentAnalyzeResponse(**result)


@router.post(
    "/document/upload",
    summary="Upload & OCR scan a medical document image"
)
async def upload_and_analyze_document(
    file: UploadFile = File(...),
    doc_type: str = Form(default="Prescription"),
    patient_name: str = Form(default="Patient"),
):
    """
    Accepts an image (JPG, PNG, WEBP) or PDF upload.
    Runs Gemini Vision OCR on images. Documents are NOT stored permanently.
    """
    ext = _validate_upload(file)

    try:
        file_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read uploaded file")

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum 15 MB allowed.")

    # Sanitize inputs
    allowed_doc_types = {"Prescription", "Medical Report", "Health Record"}
    if doc_type not in allowed_doc_types:
        doc_type = "Prescription"
    patient_name = (patient_name or "Patient").strip()[:200] or "Patient"

    logger.info(f"Document upload: type={doc_type}, ext={ext}, size={len(file_bytes)} bytes")

    # PDF: Gemini Vision needs image format
    if ext == ".pdf":
        return JSONResponse(content={
            "success": False,
            "ocr_performed": False,
            "doc_type": doc_type,
            "extracted_patient_name": patient_name,
            "doctor_or_lab_name": "",
            "date": "",
            "key_findings": [],
            "medications_mentioned": [],
            "follow_up_instructions": "",
            "raw_extracted_text": "",
            "message": (
                "PDF documents cannot be scanned directly. "
                "Please photograph your document and upload as JPG or PNG for AI scanning."
            )
        })

    # Image: Run Gemini Vision OCR
    try:
        from google import genai
        from google.genai import types as genai_types

        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("GEMINI_API_KEY not configured")

        client = genai.Client(api_key=api_key)

        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
        mime_type = mime_map.get(ext, "image/jpeg")

        vision_prompt = f"""You are a clinical laboratory document OCR and medical document analyst for GramCare AI.

Analyze this medical document image.
Document type: {doc_type}
Active Patient Name: {patient_name}

Extract ALL readable text from the image, accurately identifying laboratory test results, values, units, reference ranges, specimen info, clinical notes, and physician orders.

CRITICAL RULES:
1. ONLY extract information ACTUALLY VISIBLE in the image. Do NOT invent, assume, or fabricate any data, values, or reference ranges.
2. If any field or reference range is not present in the document, use empty string "" or "Not Provided" - NEVER invent standard ranges.
3. For laboratory reports (CBC, Lipid Profile, Liver Function, Kidney Function, Thyroid, Blood Glucose, Urine, etc.):
   - Extract individual tests into structured panels with: test_name, result, unit, reference_range, status ("Normal" | "High" | "Low" | "Abnormal" | "Not Provided").
   - If the original document indicates a flag (e.g. H, L, High, Low, *), record it accurately in status.
4. For Radiology / Narrative reports (X-Ray, Ultrasound, CT, MRI, ECG):
   - Extract modality/exam name, clinical history, technique, findings list, and impression.
5. If the document is blurry or unreadable, set key_findings to ["Document image is unclear or partially illegible. Please retake the photo with better lighting."] and extraction_status to "unclear".

Return ONLY valid JSON (no markdown fences):
{{
  "doc_type": "{doc_type}",
  "extracted_patient_name": "patient name from document or empty string",
  "patient_details": {{
    "name": "extracted patient name",
    "patient_id": "extracted patient ID / UHID / Reg No or empty string",
    "age": "extracted age or empty string",
    "gender": "extracted gender or empty string",
    "referring_doctor": "extracted referring doctor or empty string",
    "department": "extracted department or empty string"
  }},
  "report_details": {{
    "report_id": "extracted report ID / accession number or empty string",
    "laboratory_name": "extracted hospital or lab name or empty string",
    "department": "e.g. Clinical Pathology, Hematology, Biochemistry, Radiology, etc.",
    "specimen_type": "e.g. Whole Blood (EDTA), Serum, Urine or empty string",
    "collection_date": "YYYY-MM-DD or empty string",
    "collection_time": "HH:MM or empty string",
    "report_date": "YYYY-MM-DD or empty string",
    "report_time": "HH:MM or empty string",
    "status": "Final / Completed / Verified"
  }},
  "test_panels": [
    {{
      "panel_name": "e.g. Complete Blood Count (CBC) or Liver Function Test",
      "department": "e.g. Hematology or Biochemistry",
      "results": [
        {{
          "test_name": "e.g. Hemoglobin",
          "result": "13.8",
          "unit": "g/dL",
          "reference_range": "13.0 - 17.0",
          "status": "Normal"
        }}
      ]
    }}
  ],
  "narrative_sections": [
    {{
      "modality_or_exam": "e.g. Chest X-Ray PA View",
      "clinical_history": "extracted clinical indication",
      "technique": "extracted technique",
      "findings": ["finding 1", "finding 2"],
      "impression": "extracted impression"
    }}
  ],
  "abnormal_alerts": [
    {{
      "test_name": "test name with out-of-range value",
      "result": "value",
      "unit": "unit",
      "reference_range": "reference range",
      "status": "High or Low or Abnormal"
    }}
  ],
  "doctor_or_lab_name": "extracted doctor or laboratory name",
  "date": "YYYY-MM-DD or empty string",
  "key_findings": ["finding 1", "finding 2"],
  "medications_mentioned": ["medication 1 with dosage", "medication 2 with dosage"],
  "follow_up_instructions": "extracted advice or empty string",
  "ai_summary": "concise objective summary of the document contents",
  "extraction_status": "complete",
  "raw_extracted_text": "all visible text from the document"
}}"""

        image_part = genai_types.Part.from_bytes(data=file_bytes, mime_type=mime_type)

        response = None
        for model_name in ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]:
            try:
                response = client.models.generate_content(
                    model=model_name,
                    contents=[vision_prompt, image_part]
                )
                if response and response.text:
                    logger.info(f"Gemini Vision OCR succeeded with model: {model_name}")
                    break
            except Exception as model_err:
                logger.warning(f"Vision model {model_name} failed: {model_err}")

        if not response or not response.text:
            raise ValueError("Gemini Vision returned no response")

        cleaned = response.text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[-2] if "```" in cleaned[3:] else cleaned
            cleaned = cleaned.replace("```json", "").replace("```", "").strip()

        try:
            result = json.loads(cleaned)
        except Exception:
            # Fallback: wrap raw text in findings
            result = {
                "doc_type": doc_type,
                "extracted_patient_name": patient_name,
                "doctor_or_lab_name": "",
                "date": "",
                "key_findings": [cleaned[:800]] if cleaned else ["Could not parse document structure."],
                "medications_mentioned": [],
                "follow_up_instructions": "",
                "raw_extracted_text": cleaned,
                "test_panels": [],
                "narrative_sections": [],
                "abnormal_alerts": [],
                "ai_summary": cleaned[:300] if cleaned else "",
                "extraction_status": "partial"
            }

        return JSONResponse(content={
            "success": True,
            "ocr_performed": True,
            "doc_type": result.get("doc_type", doc_type),
            "extracted_patient_name": result.get("extracted_patient_name", patient_name),
            "doctor_or_lab_name": result.get("doctor_or_lab_name", ""),
            "date": result.get("date", ""),
            "key_findings": result.get("key_findings", []),
            "medications_mentioned": result.get("medications_mentioned", []),
            "follow_up_instructions": result.get("follow_up_instructions", ""),
            "raw_extracted_text": result.get("raw_extracted_text", ""),
            "patient_details": result.get("patient_details"),
            "report_details": result.get("report_details"),
            "test_panels": result.get("test_panels", []),
            "narrative_sections": result.get("narrative_sections", []),
            "abnormal_alerts": result.get("abnormal_alerts", []),
            "ai_summary": result.get("ai_summary", ""),
            "extraction_status": result.get("extraction_status", "complete"),
            "message": "Document successfully scanned and analyzed by GramCare AI."
        })

    except ValueError as ve:
        logger.warning(f"Document OCR config issue: {ve}")
        return JSONResponse(content={
            "success": False,
            "ocr_performed": False,
            "doc_type": doc_type,
            "extracted_patient_name": patient_name,
            "doctor_or_lab_name": "",
            "date": "",
            "key_findings": [],
            "medications_mentioned": [],
            "follow_up_instructions": "",
            "raw_extracted_text": "",
            "message": "AI document scanning requires GEMINI_API_KEY. Please contact your administrator."
        })
    except Exception as e:
        logger.error(f"Document upload OCR error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Document processing failed. Please try again.")

