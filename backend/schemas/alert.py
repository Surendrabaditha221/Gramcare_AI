"""
Pydantic Schemas for Alerts and Notifications API
"""
from pydantic import BaseModel
from typing import Optional

class AlertBase(BaseModel):
    category: str = "health"
    type: Optional[str] = "health"
    title: str
    teluguTitle: Optional[str] = None
    message: str
    teluguMessage: Optional[str] = None
    severity: Optional[str] = "info"
    timestamp: Optional[str] = None
    isRead: bool = False
    actionRoute: Optional[str] = None
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None

class AlertCreate(AlertBase):
    userId: Optional[str] = None

class AlertResponse(AlertBase):
    id: str
    userId: Optional[str] = None

