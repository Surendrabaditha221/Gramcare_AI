"""
Production User Profile Management Router
Allows fetching and persisting user profiles directly in MongoDB.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, Any
from database import crud

router = APIRouter()

@router.get("/users/profile", summary="Get User Profile by ID or Email")
async def get_user_profile(
    user_id: Optional[str] = Query(None, alias="userId"),
    email: Optional[str] = Query(None)
):
    """
    Search MongoDB for user profile by user_id or email.
    """
    found = None
    if email:
        found = await crud.get_user_by_email(email)
    if not found and user_id:
        found = await crud.get_user_by_id(user_id)

    if not found:
        return {
            "found": False,
            "profile": None,
            "message": "User profile not found in MongoDB."
        }

    return {
        "found": True,
        "profile": found
    }

@router.post("/users/profile", summary="Save / Update User Profile in MongoDB")
async def save_user_profile(user_data: Dict[str, Any]):
    """
    Saves or updates user profile in MongoDB. Marks isOnboardingCompleted=True.
    """
    saved = await crud.upsert_user_profile(user_data)
    return {
        "status": "success",
        "message": "User profile saved successfully in MongoDB.",
        "profile": saved
    }

@router.get("/users/by-email/{email}", summary="Get User Profile by Email")
async def get_user_by_email_param(email: str):
    """
    Find existing user profile by Google Auth email.
    """
    found = await crud.get_user_by_email(email)
    if not found:
        raise HTTPException(status_code=404, detail="User profile not found")
    return found
