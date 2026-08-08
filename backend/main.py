"""
GramCare AI Backend Application
FastAPI application entry point.
"""
import os
import sys
from contextlib import asynccontextmanager

# Ensure backend directory is in sys.path for relative imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

from database.mongo import init_db, close_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup initialization
    await init_db()
    yield
    # Shutdown cleanup
    await close_db()

app = FastAPI(
    title="GramCare AI API",
    description="Backend API for GramCare AI Rural Health Companion & Symptom Triage",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://localhost:3000,http://127.0.0.1:8001,http://127.0.0.1:8000")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and mount API routers
from routers import api_router
app.include_router(api_router)

@app.get("/health", summary="Get Backend Health Status")
async def health_check():
    """
    Direct health check endpoint to verify backend service availability.
    """
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()
    return {
        "status": "ok",
        "service": "GramCare AI API",
        "version": "1.0.0",
        "ai_available": bool(gemini_key),
        "ai_status": "configured" if gemini_key else "unconfigured_fallback_active"
    }

@app.get("/", summary="Root Endpoint")
async def root():
    return {
        "service": "GramCare AI API",
        "status": "running",
        "docs_url": "/docs",
        "health_check": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8001))
    uvicorn.run("main:app", host=host, port=port, reload=True)
