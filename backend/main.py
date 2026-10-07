"""
GramCare AI Backend Application
FastAPI application entry point (Firestore-only backend).
"""
import os
import sys
import socket
import logging
from contextlib import asynccontextmanager

# Ensure backend directory is in sys.path for relative imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# ── IPv4-preference patch ────────────────────────────────────────────────────
# Google SDK clients (Firebase Admin gRPC, google-genai) prefer IPv6 by default.
# On many Indian ISP networks, IPv6 routes to Google are advertised but unreliable,
# causing stream-reading timeouts (wsarecv error on [2001:4860:4845:...]:443).
# Patching getaddrinfo to return IPv4 results first (when available) fixes this.
os.environ.setdefault("GRPC_DNS_RESOLVER", "native")
_orig_getaddrinfo = socket.getaddrinfo
def _ipv4_preferred_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    try:
        results = _orig_getaddrinfo(host, port, family, type, proto, flags)
    except Exception:
        raise
    if family == 0 and results:
        v4 = [r for r in results if r[0] == socket.AF_INET]
        v6 = [r for r in results if r[0] == socket.AF_INET6]
        return (v4 + v6) if v4 else results
    return results
socket.getaddrinfo = _ipv4_preferred_getaddrinfo
# ────────────────────────────────────────────────────────────────────────────

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("gramcare.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup initialization for Firestore & Firebase Admin SDK
    from services.firebase_admin import init_firebase_admin, get_firestore_client
    try:
        init_firebase_admin()
        get_firestore_client()
        logger.info("GramCare AI Firestore backend initialized successfully.")
    except Exception as e:
        logger.warning(f"Firebase startup note: {e}")
    yield
    # Shutdown cleanup
    logger.info("GramCare AI backend shutdown complete.")

app = FastAPI(
    title="GramCare AI API",
    description="Backend API for GramCare AI Rural Health Companion & Symptom Triage (Firestore Powered)",
    version="1.0.0",
    lifespan=lifespan
)

from middleware.rate_limiter import RateLimiterMiddleware

# Configure CORS
env_mode = os.getenv("ENVIRONMENT", os.getenv("ENV", "development")).lower()
allowed_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:5175,http://127.0.0.1:5175,http://localhost:3000,http://127.0.0.1:8001,http://127.0.0.1:8000"
)
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

# In production, do not allow arbitrary local subnet regex
origin_regex = None if env_mode == "production" else r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register In-Memory Rate Limiter Middleware
app.add_middleware(RateLimiterMiddleware)

# Global Safe Exception Handler (Prevents stack trace leaks in responses)
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred. Please try again later."
        }
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
        "database": "Cloud Firestore",
        "version": "1.0.0",
        "ai_available": bool(gemini_key),
        "ai_status": "configured" if gemini_key else "unconfigured_fallback_active"
    }

@app.get("/", summary="Root Endpoint")
async def root():
    return {
        "service": "GramCare AI API",
        "database": "Cloud Firestore",
        "status": "running",
        "docs_url": "/docs",
        "health_check": "/health"
    }

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host=host, port=port, reload=True)
