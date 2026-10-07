"""
Routers Package Initialization
"""
from fastapi import APIRouter
from routers.health import router as health_router
from routers.auth import router as auth_router
from routers.triage import router as triage_router
from routers.chat import router as chat_router
from routers.document import router as document_router
from routers.patients import router as patients_router
from routers.records import router as records_router
from routers.facilities import router as facilities_router
from routers.alerts import router as alerts_router
from routers.sync import router as sync_router
from routers.users import router as users_router
from routers.settings import router as settings_router
from routers.appointments import router as appointments_router
from routers.firebase_test import router as firebase_test_router
from routers.emergency import router as emergency_router

api_router = APIRouter(prefix="/api")

api_router.include_router(health_router, tags=["Health"])
api_router.include_router(auth_router, tags=["Authentication"])
api_router.include_router(firebase_test_router, tags=["Firebase Verification"])
api_router.include_router(users_router, tags=["User Management"])
api_router.include_router(triage_router, tags=["Triage"])
api_router.include_router(chat_router, tags=["Chat"])
api_router.include_router(document_router, tags=["Document Analysis"])
api_router.include_router(patients_router, tags=["Patients"])
api_router.include_router(records_router, tags=["Health Records"])
api_router.include_router(facilities_router, tags=["Healthcare Facilities"])
api_router.include_router(alerts_router, tags=["Alerts & Reminders"])
api_router.include_router(settings_router, tags=["User Settings"])
api_router.include_router(appointments_router, tags=["Appointments Management"])
api_router.include_router(sync_router, tags=["Offline Sync"])
api_router.include_router(emergency_router, tags=["Emergency SOS & Family Notifications"])

