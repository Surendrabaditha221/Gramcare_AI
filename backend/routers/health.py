import os
from fastapi import APIRouter
from schemas import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse, summary="Get Backend Health Status")
async def get_health():
    """
    Health check endpoint to verify backend service availability.
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    return HealthResponse(
        status="ok",
        service="GramCare AI API",
        version="1.0.0",
        ai_available=bool(gemini_key),
        ai_status="configured" if gemini_key else "unconfigured_fallback_active"
    )
