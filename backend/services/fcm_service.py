"""
Firebase Cloud Messaging (FCM) Service for GramCare AI
Sends real-time high-priority push notifications to family members and registered devices
upon Emergency SOS activation using Firebase Admin SDK.

Zero Mock Data Directive:
- Uses real registration tokens registered by clients.
- Respects device consent and notification delivery results.
- Never discloses sensitive private medical data or precise GPS in plain notification previews.
"""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
import firebase_admin
from firebase_admin import messaging
from services.firebase_admin import init_firebase_admin

logger = logging.getLogger("gramcare.fcm")


class FCMService:
    """
    Handles push notification dispatch via Firebase Admin SDK.
    """

    @classmethod
    def _ensure_firebase(cls) -> bool:
        try:
            init_firebase_admin()
            return True
        except Exception as e:
            logger.error(f"FCM initialization check failed: {e}")
            return False

    @classmethod
    def send_emergency_sos_notification(
        cls,
        device_token: str,
        event_id: str,
        sender_user_id: str = "",
        patient_name: str = "",
        patient_phone: str = "",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        timestamp: Optional[str] = None,
        server_base_url: str = ""
    ) -> Dict[str, Any]:
        """
        Sends a high-priority Emergency SOS push notification to an individual device token.
        """
        if not cls._ensure_firebase():
            return {
                "success": False,
                "error": "Firebase Admin SDK not initialized",
                "token": device_token,
                "status": "failed"
            }

        if not device_token or not isinstance(device_token, str):
            return {
                "success": False,
                "error": "Invalid device token",
                "token": device_token,
                "status": "failed"
            }

        name_display = (patient_name or "A family member").strip()
        title = "🚨 EMERGENCY ALERT"
        body = f"{name_display} has triggered an emergency alert."

        # Target alert deep link
        click_url = f"/emergency/{event_id}"
        ts = timestamp or datetime.now().isoformat()

        # Construct FCM Message Notification
        notification = messaging.Notification(
            title=title,
            body=body,
        )

        data_payload = {
            "type": "EMERGENCY_SOS",
            "alertId": str(event_id),
            "eventId": str(event_id),
            "senderUserId": str(sender_user_id or ""),
            "senderName": name_display,
            "patientName": name_display,
            "patientPhone": str(patient_phone or ""),
            "latitude": str(latitude) if latitude is not None else "",
            "longitude": str(longitude) if longitude is not None else "",
            "timestamp": str(ts),
            "clickUrl": click_url,
            "url": click_url,
            "priority": "high"
        }

        # Webpush specific configuration for instant high-urgency vibration & sound
        webpush_fcm_options = None
        if server_base_url.startswith("https://"):
            webpush_fcm_options = messaging.WebpushFCMOptions(
                link=f"{server_base_url}{click_url}"
            )

        webpush_config = messaging.WebpushConfig(
            headers={
                "Urgency": "high"
            },
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon="/favicon.svg",
                badge="/favicon.svg",
                tag=f"sos-{event_id}",
                require_interaction=True,
                renotify=True,
                data=data_payload
            ),
            fcm_options=webpush_fcm_options
        )

        # Android specific high priority configuration
        android_config = messaging.AndroidConfig(
            priority="high",
            notification=messaging.AndroidNotification(
                title=title,
                body=body,
                icon="stock_ticker_update",
                color="#dc2626",
                channel_id="emergency_sos_channel",
                click_action=click_url
            ),
            data=data_payload
        )

        message = messaging.Message(
            token=device_token,
            notification=notification,
            data=data_payload,
            webpush=webpush_config,
            android=android_config
        )

        masked_token = (device_token[:6] + "..." + device_token[-4:]) if len(device_token) > 12 else "***"

        try:
            response = messaging.send(message)
            logger.info(f"FCM Emergency notification accepted: messageId={response}, token={masked_token}")
            return {
                "success": True,
                "messageId": response,
                "token": device_token,
                "status": "sent",  # Accepted by FCM server
                "is_stale": False
            }
        except messaging.UnregisteredError:
            logger.warning(f"FCM token is unregistered/expired: {masked_token}")
            return {
                "success": False,
                "error": "registration-token-not-registered",
                "token": device_token,
                "status": "unregistered",
                "is_stale": True
            }
        except Exception as e:
            err_str = str(e)
            logger.warning(f"FCM notification send notice: {err_str} (token={masked_token})")
            is_stale = any(phrase in err_str.lower() for phrase in [
                "not registered",
                "unregistered",
                "invalid-registration-token",
                "registration-token-not-registered",
                "invalid registration token"
            ])
            status_code = "unregistered" if is_stale else "failed"
            return {
                "success": False,
                "error": err_str,
                "token": device_token,
                "status": status_code,
                "is_stale": is_stale
            }

    @classmethod
    def send_multicast_emergency_sos(
        cls,
        tokens: List[str],
        event_id: str,
        patient_name: str,
        patient_phone: str = ""
    ) -> List[Dict[str, Any]]:
        """
        Sends notifications to multiple device tokens and aggregates delivery outcomes.
        """
        results: List[Dict[str, Any]] = []
        if not tokens:
            return results

        # Deduplicate tokens
        unique_tokens = list(set([t for t in tokens if t and isinstance(t, str)]))

        for token in unique_tokens:
            res = cls.send_emergency_sos_notification(
                device_token=token,
                event_id=event_id,
                patient_name=patient_name,
                patient_phone=patient_phone
            )
            results.append(res)

        return results

    @classmethod
    def send_test_notification(cls, device_token: str) -> Dict[str, Any]:
        """
        Sends a test notification to verify FCM device integration.
        """
        if not cls._ensure_firebase():
            return {"success": False, "error": "Firebase Admin SDK not initialized"}

        try:
            message = messaging.Message(
                token=device_token,
                notification=messaging.Notification(
                    title="GramCare AI – Notification Test",
                    body="Your device is successfully registered for GramCare AI Family Emergency Alerts."
                ),
                data={
                    "type": "TEST_NOTIFICATION",
                    "timestamp": datetime.now().isoformat()
                }
            )
            response = messaging.send(message)
            return {"success": True, "messageId": response}
        except Exception as e:
            return {"success": False, "error": str(e)}
