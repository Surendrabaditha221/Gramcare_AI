"""
Offline Data Synchronization Router for GramCare AI
Merges queued offline changes with Firestore subcollections.
"""
from fastapi import APIRouter
from schemas import SyncRequest, SyncResponse
from services import (
    firestore_family_service,
    firestore_record_service,
    firestore_alert_service,
    firestore_triage_service
)
from services.data_store import memory_store

router = APIRouter()

@router.post("/sync", response_model=SyncResponse, summary="Sync Offline Store to Firestore")
async def sync_offline_data(request: SyncRequest):
    """
    Accepts locally stored data (patients, records, alerts, triage logs) when connectivity returns and merges with Firestore.
    """
    synced_patients = 0
    synced_records = 0
    synced_alerts = 0
    synced_triage = 0

    if request.patients:
        for p in request.patients:
            patient_dict = dict(p)
            uid = patient_dict.get("userId") or patient_dict.get("uid") or "user_primary"
            p_id = str(patient_dict.get("id") or "").strip().lower()
            p_name = str(patient_dict.get("fullName") or "").strip().lower()
            p_rel = str(patient_dict.get("relation") or "").strip().lower()

            family_members = patient_dict.pop("familyMembers", None)

            # Do not create user_primary or ghost entry as family member
            if not (p_id == "user_primary" or p_name == "baditha surendra other" or (p_name == "baditha surendra" and p_rel in ["other", "self", "myself", ""])):
                await firestore_family_service.create_family_member(uid, patient_dict)
                memory_store.add_patient(patient_dict)
                synced_patients += 1

            if family_members and isinstance(family_members, list):
                for fm in family_members:
                    if isinstance(fm, dict):
                        fm_id = str(fm.get("id") or "").strip().lower()
                        fm_name = str(fm.get("fullName") or "").strip().lower()
                        fm_rel = str(fm.get("relation") or "").strip().lower()
                        if fm_id == "user_primary" or fm_name == "baditha surendra other" or (fm_name == "baditha surendra" and fm_rel in ["other", "self", "myself", ""]):
                            continue
                        await firestore_family_service.create_family_member(uid, fm)
                        memory_store.add_patient(fm)

    if request.records:
        for r in request.records:
            record_dict = dict(r)
            uid = record_dict.get("userId") or record_dict.get("uid") or "user_primary"
            await firestore_record_service.create_record(uid, record_dict)
            memory_store.add_record(record_dict)
            synced_records += 1

    if request.alerts:
        for a in request.alerts:
            alert_dict = dict(a)
            uid = alert_dict.get("userId") or alert_dict.get("uid") or "user_primary"
            await firestore_alert_service.create_alert(uid, alert_dict)
            memory_store.add_alert(alert_dict)
            synced_alerts += 1

    if request.triage_logs:
        for t in request.triage_logs:
            triage_dict = dict(t)
            uid = triage_dict.get("userId") or triage_dict.get("user_id") or "user_primary"
            await firestore_triage_service.create_triage_log(uid, triage_dict)
            memory_store.save_triage_log(triage_dict)
            synced_triage += 1

    return SyncResponse(
        status="success",
        synced_patients_count=synced_patients,
        synced_records_count=synced_records,
        synced_alerts_count=synced_alerts,
        synced_triage_logs_count=synced_triage,
        message=f"Successfully synchronized offline data ({synced_patients} patients, {synced_records} records, {synced_alerts} alerts, {synced_triage} triage logs)."
    )
