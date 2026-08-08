"""
Offline Data Synchronization Router
"""
from fastapi import APIRouter
from schemas import SyncRequest, SyncResponse
from database import crud
from services.data_store import memory_store

router = APIRouter()

@router.post("/sync", response_model=SyncResponse, summary="Sync Offline Store to Backend")
async def sync_offline_data(request: SyncRequest):
    """
    Accepts locally stored data (patients, records, alerts, triage logs) when connectivity returns and merges with backend store & MongoDB Atlas.
    """
    synced_patients = 0
    synced_records = 0
    synced_alerts = 0
    synced_triage = 0

    if request.patients:
        for p in request.patients:
            patient_dict = dict(p)
            family_members = patient_dict.pop("familyMembers", None)
            await crud.upsert_patient(patient_dict)
            memory_store.add_patient(patient_dict)
            synced_patients += 1
            if family_members and isinstance(family_members, list):
                for fm in family_members:
                    if isinstance(fm, dict):
                        await crud.upsert_patient(fm)
                        memory_store.add_patient(fm)

    if request.records:
        for r in request.records:
            record_dict = dict(r)
            await crud.add_record(record_dict)
            memory_store.add_record(record_dict)
            synced_records += 1

    if request.alerts:
        for a in request.alerts:
            alert_dict = dict(a)
            await crud.add_alert(alert_dict)
            memory_store.add_alert(alert_dict)
            synced_alerts += 1

    if request.triage_logs:
        for t in request.triage_logs:
            triage_dict = dict(t)
            await crud.save_triage_log(triage_dict)
            memory_store.save_triage_log(triage_dict)
            synced_triage += 1

    return SyncResponse(
        status="success",
        synced_patients_count=synced_patients,
        synced_records_count=synced_records,
        synced_alerts_count=synced_alerts,
        synced_triage_logs_count=synced_triage,
        message=f"Successfully synchronized offline data ({synced_patients} patients, {synced_records} records, {synced_alerts} alerts)."
    )
