"""
Settings Router for GramCare AI
Handles user settings persistence (Theme, Notifications, Language, Emergency Contacts, Password Change)
using Firestore collection users/{uid}/settings/main with strict Firebase UID scoping.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
from services import firestore_settings_service, firestore_user_service
from routers.auth import get_current_user_from_token
from services.auth_service import hash_password, verify_password

router = APIRouter(prefix="/settings", tags=["User Settings"])


@router.get("", summary="Get User Settings")
async def get_settings(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Retrieves user application settings from Firestore users/{uid}/settings/main.
    """
    uid = current_user["uid"]
    settings = await firestore_settings_service.get_settings(uid)
    return settings


@router.post("", summary="Save / Update User Settings")
@router.put("", summary="Save / Update User Settings")
async def update_settings(
    settings_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Saves or updates user application settings in Firestore users/{uid}/settings/main.
    Enforces verified Firebase token UID.
    """
    uid = current_user["uid"]
    settings_data["userId"] = uid  # Override any body spoofing

    saved = await firestore_settings_service.update_settings(uid, settings_data)
    return saved


@router.post("/change-password", summary="Change Password")
async def change_password(
    data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Updates user password in Firestore.
    """
    old_pwd = data.get("oldPassword")
    new_pwd = data.get("newPassword")
    if not old_pwd or not new_pwd:
        raise HTTPException(status_code=400, detail="Old password and new password are required")

    uid = current_user.get("uid") or current_user.get("id")
    hashed = current_user.get("hashedPassword")
    if hashed and not verify_password(old_pwd, hashed):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    new_hashed = hash_password(new_pwd)
    await firestore_user_service.update_user(uid, {"hashedPassword": new_hashed})
    return {"status": "success", "message": "Password changed successfully."}
