"""
Firebase Verification Test Router for GramCare AI
Provides endpoint GET /api/firebase/test-auth to verify Firebase Admin ID token authentication.
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any
from services.firebase_admin import get_current_firebase_user

router = APIRouter(prefix="/firebase", tags=["Firebase Verification"])


@router.get("/test-auth", summary="Test Firebase ID Token Authentication")
async def test_firebase_auth(
    current_user: Dict[str, Any] = Depends(get_current_firebase_user)
):
    """
    Development diagnostic endpoint.
    Requires a valid Firebase ID token in Authorization header: Bearer <id_token>
    Returns safe user metadata without exposing tokens or secrets.
    """
    return {
        "authenticated": True,
        "uid": current_user.get("uid"),
        "email": current_user.get("email"),
        "displayName": current_user.get("displayName")
    }
