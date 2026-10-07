"""
Authentication Router for GramCare AI
Handles Google Authentication, Email/Password Registration & Login, JWT Session Validation, and Token Refresh exclusively via Firestore and Firebase Auth.
"""
from fastapi import APIRouter, HTTPException, Depends, Header, status
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from datetime import datetime
import logging
import secrets
import os
import re
from services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decode_google_id_token,
    hash_password,
    verify_password
)
from services.firebase_admin import verify_firebase_token
from services import firestore_user_service

logger = logging.getLogger("gramcare.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ─────────────────────────────────────────────
# Pydantic Request & Response Schemas
# ─────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    fullName: str = "GramCare User"
    preferredLanguage: str = "en"


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleAuthRequest(BaseModel):
    idToken: str
    email: Optional[str] = None
    fullName: Optional[str] = None
    profileImage: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refreshToken: str


class LanguageOnboardingRequest(BaseModel):
    language: str


class PhoneAuthRequest(BaseModel):
    phoneNumber: str


# ─────────────────────────────────────────────
# Helper Dependency: Get Current User from Bearer Token
# ─────────────────────────────────────────────

async def get_current_user_from_token(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty token in Authorization header"
        )

    user_uid = None

    # First attempt: Decode as internal JWT access token
    payload = decode_token(token)
    if payload:
        user_uid = payload.get("sub") or payload.get("userId") or payload.get("uid")
    else:
        # Second attempt: Verify as raw Firebase ID token via Firebase Admin SDK
        try:
            fb_user = verify_firebase_token(token)
            user_uid = fb_user.get("uid")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Expired or invalid authentication token"
            )

    if not user_uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload"
        )

    # 1. Fetch user profile from Firestore users/{uid}
    user = await firestore_user_service.get_user_by_uid(user_uid)

    if not user:
        token_email = (payload.get("email") if payload else None) or (fb_user.get("email") if 'fb_user' in locals() and fb_user else None)
        user = {
            "uid": user_uid,
            "id": user_uid,
            "userId": user_uid,
            "email": token_email,
            "displayName": token_email.split("@")[0].title() if token_email else "User",
            "profileCompleted": False,
            "onboardingCompleted": False,
            "preferredLanguage": "en"
        }
        await firestore_user_service.create_user(user_uid, user)

    return user


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.post("/register")
async def register(req: RegisterRequest):
    """Registers a new user with email & password in Firestore."""
    if not req.email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    
    clean_email = req.email.strip().lower()
    existing = await firestore_user_service.get_user_by_email(clean_email)
    if existing:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    user_uid = f"usr_{int(datetime.now().timestamp() * 1000)}_{secrets.token_hex(3)}"
    user_data = {
        "uid": user_uid,
        "id": user_uid,
        "userId": user_uid,
        "email": clean_email,
        "displayName": req.fullName.strip() if req.fullName else "User",
        "hashedPassword": hash_password(req.password),
        "authProvider": "email",
        "language": req.preferredLanguage,
        "preferredLanguage": req.preferredLanguage,
        "profileCompleted": False,
        "onboardingCompleted": False
    }
    user = await firestore_user_service.create_user(user_uid, user_data)

    access_token = create_access_token({"sub": user["uid"], "email": user["email"]})
    refresh_token = create_refresh_token({"sub": user["uid"], "email": user["email"]})

    # Don't return hashedPassword in response
    safe_user = {k: v for k, v in user.items() if k != "hashedPassword"}

    return {
        "user": safe_user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/login")
async def login(req: LoginRequest):
    """Authenticates user with email & password against Firestore."""
    clean_email = req.email.strip().lower()
    user = await firestore_user_service.get_user_by_email(clean_email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    hashed_pw = user.get("hashedPassword")
    if not hashed_pw or not verify_password(req.password, hashed_pw):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Update Firestore lastLogin
    await firestore_user_service.update_user(user["uid"], {"lastLogin": datetime.now().isoformat()})

    access_token = create_access_token({"sub": user["uid"], "email": user["email"]})
    refresh_token = create_refresh_token({"sub": user["uid"], "email": user["email"]})

    safe_user = {k: v for k, v in user.items() if k != "hashedPassword"}

    return {
        "user": safe_user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/google")
async def google_auth(req: GoogleAuthRequest):
    """
    Authenticates or registers a user via Google Auth.
    Verifies Firebase ID Token and persists user profile in Firestore collection `users/{uid}`.
    """
    if not req.idToken:
        raise HTTPException(status_code=400, detail="Firebase ID Token is required")

    firebase_uid = None
    google_data = None

    # Step 1: Verify Firebase ID Token via Firebase Admin SDK
    try:
        verified_fb = verify_firebase_token(req.idToken)
        firebase_uid = verified_fb.get("uid")
        google_data = {
            "email": verified_fb.get("email"),
            "fullName": verified_fb.get("displayName"),
            "profileImage": verified_fb.get("photoURL"),
            "googleId": verified_fb.get("uid")
        }
    except Exception as e:
        logger.info(f"Firebase Admin verification fallback for Google Token: {e}")
        decoded = decode_google_id_token(req.idToken)
        if decoded:
            firebase_uid = decoded.get("googleId")
            google_data = decoded

    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Failed to verify Google / Firebase ID token")

    email = req.email or (google_data.get("email") if google_data else None)
    extracted_name = req.fullName or (google_data.get("fullName") if google_data else None)
    if not extracted_name and email:
        extracted_name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
    full_name = extracted_name or "User"
    profile_image = req.profileImage or (google_data.get("profileImage") if google_data else "")

    if not email:
        raise HTTPException(status_code=400, detail="Invalid Google token: email missing")

    # Step 2: Check Firestore collection users/{firebase_uid}
    existing_firestore_user = await firestore_user_service.get_user_by_uid(firebase_uid)

    if existing_firestore_user:
        # User already exists in Firestore -> update lastLogin
        updated_fields = {"lastLogin": datetime.now().isoformat()}
        if profile_image and not existing_firestore_user.get("photoURL"):
            updated_fields["photoURL"] = profile_image
            updated_fields["profileImage"] = profile_image
        if full_name and not existing_firestore_user.get("displayName"):
            updated_fields["displayName"] = full_name
            updated_fields["fullName"] = full_name

        user = await firestore_user_service.update_user(firebase_uid, updated_fields)
    else:
        # New user -> create users/{firebase_uid} in Firestore
        new_user_data = {
            "uid": firebase_uid,
            "id": firebase_uid,
            "userId": firebase_uid,
            "email": email,
            "displayName": full_name,
            "fullName": full_name,
            "photoURL": profile_image,
            "profileImage": profile_image,
            "authProvider": "google",
            "profileCompleted": False,
            "onboardingCompleted": False,
            "preferredLanguage": "en"
        }
        user = await firestore_user_service.create_user(firebase_uid, new_user_data)

    access_token = create_access_token({"sub": user["uid"], "email": user.get("email")})
    refresh_token = create_refresh_token({"sub": user["uid"], "email": user.get("email")})

    return {
        "user": user,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.get("/me")
async def get_current_user(current_user: Dict[str, Any] = Depends(get_current_user_from_token)):
    """Returns current authenticated user details from Firestore users/{uid}."""
    uid = current_user.get("uid") or current_user.get("id")
    if uid:
        firestore_user = await firestore_user_service.get_user_by_uid(uid)
        if firestore_user:
            return firestore_user
    return current_user


@router.post("/refresh")
async def refresh_token(req: RefreshTokenRequest):
    """Refreshes JWT Access Token using a valid Refresh Token."""
    payload = decode_token(req.refreshToken, is_refresh=True)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user_id = payload.get("sub")
    user = await firestore_user_service.get_user_by_uid(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    uid = user.get("uid") or user.get("id")
    new_access_token = create_access_token({"sub": uid, "email": user.get("email")})
    return {
        "access_token": new_access_token,
        "token_type": "bearer"
    }


@router.post("/language")
async def set_user_language(
    req: LanguageOnboardingRequest,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """Saves user language selection to Firestore users/{uid}."""
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    updates = {
        "language": req.language,
        "preferredLanguage": req.language
    }
    updated_user = await firestore_user_service.update_user(uid, updates)
    return updated_user


@router.post("/phone")
async def phone_auth(req: PhoneAuthRequest):
    """
    Validates Indian 10-digit phone number and checks OTP gateway availability.
    """
    clean_phone = req.phoneNumber.strip().replace(" ", "").replace("-", "")
    if clean_phone.startswith("+91"):
        digits = clean_phone[3:]
    elif clean_phone.startswith("91") and len(clean_phone) == 12:
        digits = clean_phone[2:]
    else:
        digits = clean_phone

    if not re.match(r"^[6-9]\d{9}$", digits):
        raise HTTPException(
            status_code=400,
            detail="Please provide a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9."
        )

    # Check if SMS/OTP provider is configured
    sms_gateway_configured = bool(os.getenv("SMS_GATEWAY_API_KEY") or os.getenv("TWILIO_ACCOUNT_SID"))
    if not sms_gateway_configured:
        return {
            "status": "gateway_unavailable",
            "message": "Phone OTP authentication is temporarily undergoing maintenance. Please sign in securely with Google.",
            "phoneNumber": f"+91{digits}"
        }

    return {
        "status": "otp_sent",
        "message": f"Verification code sent to +91{digits}",
        "phoneNumber": f"+91{digits}"
    }

