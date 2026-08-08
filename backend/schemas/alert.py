"""
Pydantic Schemas for Alerts and Notifications API
"""
from pydantic import BaseModel
from typing import Optional

class AlertBase(BaseModel):
    category: str = "health"
    title: str
    teluguTitle: Optional[str] = None
    message: str
    teluguMessage: Optional[str] = None
    timestamp: str
    isRead: bool = False
    actionRoute: Optional[str] = None

class AlertCreate(AlertBase):
    pass

class AlertResponse(AlertBase):
    id: str
