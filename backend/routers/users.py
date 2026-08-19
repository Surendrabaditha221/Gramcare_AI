"""
User Profile Management Router for GramCare AI
Persists user profiles exclusively in Firestore collection `users/{uid}`.
"""
from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional, Dict, Any
from services import firestore_user_service
from routers.auth import get_current_user_from_token

router = APIRouter(prefix="/users", tags=["User Profiles"])


@router.get("/profile", summary="Get User Profile")
async def get_user_profile(
    user_id: Optional[str] = Query(None, alias="userId"),
    email: Optional[str] = Query(None),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_from_token)
):
    """Fetches user profile from Firestore users/{uid} using verified token or query."""
    target_uid = (current_user.get("uid") if current_user else None) or user_id
    found = None

    if target_uid:
        found = await firestore_user_service.get_user_by_uid(target_uid)
    if not found and email:
        found = await firestore_user_service.get_user_by_email(email)

    if not found:
        return {
            "found": False,
            "profile": None,
            "message": "User profile not found."
        }

    return {
        "found": True,
        "profile": found
    }


@router.post("/profile", summary="Save / Update User Profile in Firestore")
@router.put("/profile", summary="Update User Profile in Firestore")
async def save_user_profile(
    user_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Saves or updates user profile in Firestore collection `users/{uid}`.
    Enforces the authenticated UID from the verified token.
    Sets profileCompleted=True and onboardingCompleted=True.
    """
    authenticated_uid = current_user.get("uid") or current_user.get("id")
    if not authenticated_uid:
        raise HTTPException(status_code=401, detail="Authenticated UID missing from token")

    # Enforce verified UID from token — do NOT trust caller payload to change UID
    profile_payload = dict(user_data)
    profile_payload["uid"] = authenticated_uid
    profile_payload["id"] = authenticated_uid
    profile_payload["userId"] = authenticated_uid

    # Update Firestore users/{uid}
    saved_profile = await firestore_user_service.update_user_profile(authenticated_uid, profile_payload)

    return {
        "status": "success",
        "message": "User profile saved successfully in Firestore users/{uid}.",
        "profile": saved_profile
    }


@router.get("/by-email/{email}", summary="Get User Profile by Email")
async def get_user_by_email_param(email: str):
    """Find existing user profile by email in Firestore."""
    found = await firestore_user_service.get_user_by_email(email)
    if not found:
        raise HTTPException(status_code=404, detail="User profile not found")
    return found


@router.delete("/account", summary="Delete User Account and Data")
async def delete_user_account(current_user: Dict[str, Any] = Depends(get_current_user_from_token)):
    """Deletes user document from Firestore users/{uid}."""
    user_id = current_user.get("uid") or current_user.get("id")
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    success = await firestore_user_service.delete_user(user_id)
    return {
        "status": "success" if success else "failed",
        "message": "Account and associated data deleted successfully."
    }
