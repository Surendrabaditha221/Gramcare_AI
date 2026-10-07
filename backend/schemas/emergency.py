"""
Emergency SOS & Family Notification Schemas for GramCare AI
Defines strict Pydantic models for Emergency Events, Contact Management,
Push Device Tokens, Email Deliveries, Acknowledgement, and Audit Logging.
"""
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict, Any
import re

# Standard RFC-compliant email validation pattern
EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")


class EmergencyLocation(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracyMeters: Optional[float] = None
    address: Optional[str] = None
    timestamp: Optional[str] = None


class EmergencySOSCreate(BaseModel):
    location: Optional[EmergencyLocation] = None
    notes: Optional[str] = None
    severity: Optional[str] = "CRITICAL"
    targetContactId: Optional[str] = None


class EmergencyEventStatusAudit(BaseModel):
    status: str
    timestamp: str
    updatedBy: str
    notes: Optional[str] = None


class EmergencyNotificationRecord(BaseModel):
    contactId: str
    contactName: str
    contactPhone: Optional[str] = ""
    email: Optional[str] = None
    emailStatus: Optional[str] = None  # "queued" | "sent" | "failed" | "email_not_configured" | "unavailable" | "not_configured"
    deviceToken: Optional[str] = None
    status: str = "unavailable"  # "sent" | "delivered" | "opened" | "acknowledged" | "unavailable" | "failed"
    fcmMessageId: Optional[str] = None
    error: Optional[str] = None
    timestamp: str


class EmergencyEmailRecipientRecord(BaseModel):
    contactId: Optional[str] = None
    contactName: Optional[str] = None
    email: str
    status: str = "queued"  # "queued" | "sent" | "failed" | "email_not_configured"
    mailJobId: Optional[str] = None
    error: Optional[str] = None
    timestamp: str


class EmergencyEmailDeliveryRecord(BaseModel):
    attempted: bool = False
    totalRecipients: int = 0
    queued: int = 0
    sent: int = 0
    failed: int = 0
    unconfigured: int = 0
    recipients: List[EmergencyEmailRecipientRecord] = []


class EmergencyAcknowledgeRequest(BaseModel):
    responderName: str = Field(..., min_length=1)
    responderPhone: Optional[str] = None
    responderRelation: Optional[str] = None
    message: Optional[str] = None


class EmergencyResolveRequest(BaseModel):
    resolvedBy: str = Field(..., min_length=1)
    resolutionNotes: Optional[str] = None


class EmergencyStatusUpdateRequest(BaseModel):
    status: str = Field(..., min_length=1)
    notes: Optional[str] = None


class EmergencyEventDeliveryUpdate(BaseModel):
    contactId: Optional[str] = None
    source: Optional[str] = "client"


class EmergencyEventResponse(BaseModel):
    id: str
    alertId: Optional[str] = None
    patientUid: str
    senderUserId: Optional[str] = None
    patientName: str
    senderName: Optional[str] = None
    patientPhone: Optional[str] = None
    status: str  # "SOS Initiated" | "Alert Processing" | "Notifications Submitted" | "Family Acknowledged" | "Help Is on the Way" | "Resolved" | "Cancelled"
    createdAt: str
    updatedAt: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    locationAccuracy: Optional[float] = None
    locationAvailable: bool = False
    location: Optional[EmergencyLocation] = None
    auditTrail: List[EmergencyEventStatusAudit] = []
    notifiedContacts: List[EmergencyNotificationRecord] = []
    contactsNotifiedCount: int = 0
    contactsUnavailableCount: int = 0
    contactsFailedCount: int = 0
    deliveryAttempts: Any = 0
    emailDelivery: Optional[EmergencyEmailDeliveryRecord] = None
    emailsQueuedCount: int = 0
    emailsSentCount: int = 0
    emailsFailedCount: int = 0
    acknowledgedBy: Optional[Dict[str, Any]] = None
    resolvedBy: Optional[Dict[str, Any]] = None


class EmergencyContactBase(BaseModel):
    fullName: str = Field(..., min_length=1)
    relation: str = Field(..., min_length=1)
    phone: Optional[str] = None
    email: Optional[str] = None
    contactUserId: Optional[str] = None
    notifyOnSOS: bool = True
    isEmergencyContact: bool = True
    isActive: bool = True
    hasPushDevice: bool = False
    hasEmail: bool = False
    notificationStatus: str = "Push notifications unavailable"
    emailStatus: str = "Email not configured"
    resolutionStatus: Optional[str] = None
    statusReason: Optional[str] = None
    isDuplicate: Optional[bool] = False
    linkedUserName: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def validate_contact_channels(cls, data: Any) -> Any:
        if isinstance(data, dict):
            raw_phone = data.get("phone")
            raw_email = data.get("email")

            phone_clean = raw_phone.strip() if isinstance(raw_phone, str) else None
            email_clean = raw_email.strip().lower() if isinstance(raw_email, str) else None

            # Re-assign cleaned values or None
            data["phone"] = phone_clean if phone_clean else None
            data["email"] = email_clean if email_clean else None

            if not data["phone"] and not data["email"]:
                raise ValueError("At least one contact channel (phone or email) must be provided.")

            if data["email"]:
                if not EMAIL_REGEX.match(data["email"]):
                    raise ValueError(f"Invalid email address format: {data['email']}")
                data["hasEmail"] = True
                data["emailStatus"] = "Email Alerts Ready"
            else:
                data["hasEmail"] = False
                data["emailStatus"] = "Email not configured"

            if data["phone"] and len(data["phone"]) < 5:
                raise ValueError("Phone number must have at least 5 digits.")
        return data


class EmergencyContactCreate(EmergencyContactBase):
    id: Optional[str] = None
    deviceTokens: List[str] = []


class EmergencyContactUpdate(BaseModel):
    fullName: Optional[str] = None
    relation: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    contactUserId: Optional[str] = None
    notifyOnSOS: Optional[bool] = None
    isEmergencyContact: Optional[bool] = None
    isActive: Optional[bool] = None
    deviceTokens: Optional[List[str]] = None

    @model_validator(mode="before")
    @classmethod
    def clean_update_channels(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "email" in data and isinstance(data["email"], str):
                cleaned_email = data["email"].strip().lower()
                if cleaned_email:
                    if not EMAIL_REGEX.match(cleaned_email):
                        raise ValueError(f"Invalid email address format: {cleaned_email}")
                    data["email"] = cleaned_email
                else:
                    data["email"] = None
            if "phone" in data and isinstance(data["phone"], str):
                cleaned_phone = data["phone"].strip()
                data["phone"] = cleaned_phone if cleaned_phone else None
        return data


class EmergencyContactResponse(EmergencyContactBase):
    id: str
    patientUid: str
    isVerified: bool = False
    deviceTokens: List[str] = []
    createdAt: str
    updatedAt: str


class DeviceTokenRegisterRequest(BaseModel):
    fcmToken: str = Field(..., min_length=10)
    deviceType: Optional[str] = "web"
    deviceName: Optional[str] = "Browser"
    contactId: Optional[str] = None
    consentGranted: bool = True
