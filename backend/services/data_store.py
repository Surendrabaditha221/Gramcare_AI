"""
In-Memory / Persistent Storage Service for GramCare AI Backend
Used as a reliable fallback when MongoDB is not connected.
"""
from datetime import datetime
from typing import List, Dict, Any, Optional

DEFAULT_FACILITIES: List[Dict[str, Any]] = []
DEFAULT_PATIENTS: List[Dict[str, Any]] = []
DEFAULT_RECORDS: List[Dict[str, Any]] = []
DEFAULT_ALERTS: List[Dict[str, Any]] = []

class MemoryDataStore:
    def __init__(self):
        self.patients: List[Dict[str, Any]] = list(DEFAULT_PATIENTS)
        self.records: List[Dict[str, Any]] = list(DEFAULT_RECORDS)
        self.facilities: List[Dict[str, Any]] = list(DEFAULT_FACILITIES)
        self.alerts: List[Dict[str, Any]] = list(DEFAULT_ALERTS)
        self.triage_history: List[Dict[str, Any]] = []
        self.chat_history: List[Dict[str, Any]] = []
        self.users: Dict[str, Dict[str, Any]] = {}

    def get_patients(self) -> List[Dict[str, Any]]:
        seen_names = set()
        seen_ids = set()
        unique = []
        for p in self.patients:
            p_id = p.get("id")
            p_name = (p.get("fullName") or "").strip().lower()
            if (p_id and p_id in seen_ids) or (p_name and p_name in seen_names):
                continue
            if p_id:
                seen_ids.add(p_id)
            if p_name:
                seen_names.add(p_name)
            unique.append(p)
        self.patients = unique
        return self.patients

    def get_patient_by_id(self, patient_id: str) -> Optional[Dict[str, Any]]:
        for p in self.patients:
            if p.get("id") == patient_id:
                return p
        return None

    def add_patient(self, patient: Dict[str, Any]) -> Dict[str, Any]:
        p_id = patient.get("id")
        p_name = (patient.get("fullName") or "").strip().lower()

        # Check if patient already exists by ID or by Name
        for idx, existing in enumerate(self.patients):
            ex_id = existing.get("id")
            ex_name = (existing.get("fullName") or "").strip().lower()

            if (p_id and ex_id == p_id) or (p_name and p_name == ex_name):
                updated = {**existing, **patient}
                if not updated.get("id"):
                    updated["id"] = ex_id or p_id or f"pat_{int(datetime.now().timestamp() * 1000)}"
                self.patients[idx] = updated
                return updated

        if not patient.get("id"):
            patient["id"] = f"pat_{int(datetime.now().timestamp() * 1000)}"
        self.patients.append(patient)
        return patient

    def get_records(self, patient_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if patient_id:
            return [r for r in self.records if r.get("patientId") == patient_id]
        return self.records

    def add_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        if not record.get("id"):
            record["id"] = f"rec_{int(datetime.now().timestamp() * 1000)}"
        self.records.insert(0, record)
        return record

    def get_facilities(self) -> List[Dict[str, Any]]:
        return self.facilities

    def get_alerts(self) -> List[Dict[str, Any]]:
        return self.alerts

    def add_alert(self, alert: Dict[str, Any]) -> Dict[str, Any]:
        if not alert.get("id"):
            alert["id"] = f"notif_{int(datetime.now().timestamp() * 1000)}"
        self.alerts.insert(0, alert)
        return alert

    def save_triage_log(self, log: Dict[str, Any]) -> Dict[str, Any]:
        if not log.get("id"):
            log["id"] = f"triage_{int(datetime.now().timestamp() * 1000)}"
        self.triage_history.append(log)
        return log

memory_store = MemoryDataStore()
