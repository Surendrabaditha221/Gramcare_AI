"""
Firebase Admin SDK Initialization & Verification Service for GramCare AI
Provides secure server-side Firebase ID token verification and Firestore client initialization.
"""
import os
import json
import logging
from typing import Dict, Any, Optional

import firebase_admin
from firebase_admin import credentials, auth, firestore
from fastapi import HTTPException, Header, status, Depends
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("gramcare.firebase_admin")

_firebase_app: Optional[firebase_admin.App] = None
_firestore_db = None
_firestore_db_attempted = False


def init_firebase_admin() -> firebase_admin.App:
    """
    Initializes Firebase Admin SDK as a singleton.
    Loads credentials safely from environment variables / service account without exposing secrets.
    """
    global _firebase_app
    if _firebase_app is not None or len(firebase_admin._apps) > 0:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app

    project_id = os.getenv("FIREBASE_PROJECT_ID", "gramcare-ai-5fffb")
    service_account_path = (
        os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH") or 
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    )
    service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")

    cred = None

    if service_account_path:
        # Support relative path resolution from backend directory
        if not os.path.exists(service_account_path) and not os.path.isabs(service_account_path):
            backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            candidate = os.path.join(backend_dir, service_account_path.lstrip("./\\"))
            if os.path.exists(candidate):
                service_account_path = candidate

        if os.path.exists(service_account_path):
            logger.info(f"Initializing Firebase Admin with service account file")
            cred = credentials.Certificate(service_account_path)
            if hasattr(cred, "project_id") and cred.project_id:
                project_id = cred.project_id
    elif service_account_json:
        try:
            logger.info("Initializing Firebase Admin with service account JSON from environment")
            key_dict = json.loads(service_account_json)
            cred = credentials.Certificate(key_dict)
            if hasattr(cred, "project_id") and cred.project_id:
                project_id = cred.project_id
        except Exception as e:
            logger.warning(f"Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON: {e}")

    options = {"projectId": project_id} if project_id else {}

    try:
        if cred:
            _firebase_app = firebase_admin.initialize_app(cred, options)
        else:
            logger.info(f"Initializing Firebase Admin with default credentials for project: {project_id}")
            _firebase_app = firebase_admin.initialize_app(options=options)
        logger.info(f"Firebase Admin SDK initialized successfully (Project ID: {project_id})")
    except Exception as e:
        logger.error(f"Error initializing Firebase Admin SDK: {e}")
        # Fallback initialization attempt if app already exists in firebase_admin state
        if len(firebase_admin._apps) > 0:
            _firebase_app = firebase_admin.get_app()
        else:
            raise e

    return _firebase_app


def get_firestore_client():
    """
    Returns initialized Google Cloud Firestore client.
    Does NOT create any documents or collections.
    """
    global _firestore_db, _firestore_db_attempted
    if _firestore_db is None and not _firestore_db_attempted:
        _firestore_db_attempted = True
        init_firebase_admin()
        try:
            _firestore_db = firestore.client()
            logger.info("Firestore client initialized successfully")
        except Exception as e:
            logger.warning(f"Firestore client initialization notice: {e}. (Set FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS in backend/.env for server-side Firestore access)")
            return None
    return _firestore_db


def verify_firebase_token(id_token_str: str) -> Dict[str, Any]:
    """
    Verifies Firebase ID token using Firebase Admin SDK.
    Returns authenticated user information dict (uid, email, displayName, photoURL).
    Raises HTTPException 401 on invalid, expired, or malformed tokens.
    """
    if not id_token_str or not isinstance(id_token_str, str) or len(id_token_str.split(".")) != 3:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid token string"
        )
    init_firebase_admin()

    try:
        # Verify token against Firebase Auth servers (clock_skew_seconds allows 5s drift)
        decoded_token = auth.verify_id_token(id_token_str, check_revoked=False, clock_skew_seconds=5)
        uid = decoded_token.get("uid") or decoded_token.get("sub")
        if not uid:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Firebase token missing UID claim"
            )

        email = decoded_token.get("email")
        display_name = decoded_token.get("name") or decoded_token.get("displayName")
        photo_url = decoded_token.get("picture") or decoded_token.get("photoURL")

        return {
            "uid": uid,
            "email": email or None,
            "displayName": display_name or None,
            "photoURL": photo_url or None,
            "emailVerified": decoded_token.get("email_verified", False)
        }

    except auth.ExpiredIdTokenError:
        logger.warning("Firebase ID token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has expired"
        )
    except auth.RevokedIdTokenError:
        logger.warning("Firebase ID token revoked")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has been revoked"
        )
    except auth.InvalidIdTokenError as e:
        logger.warning(f"Invalid Firebase ID token: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID token"
        )
    except Exception as e:
        logger.warning(f"Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed: invalid token"
        )


async def get_current_firebase_user(
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """
    FastAPI dependency that extracts Bearer Firebase ID token from Authorization header,
    verifies it with Firebase Admin SDK, and returns authenticated user info.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty Authorization token"
        )

    return verify_firebase_token(token)
