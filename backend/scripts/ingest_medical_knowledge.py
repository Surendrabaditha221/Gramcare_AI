"""
Ingestion & Validation Script for GramCare AI Medical Knowledge Base
Validates source metadata schema and ingests authoritative documents
into the shared collection `medical_knowledge_base`.
"""
import os
import sys
import json
import logging
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"))

from services.firebase_admin import get_firestore_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gramcare.ingestion")

REQUIRED_FIELDS = [
    "sourceId",
    "title",
    "organization",
    "url",
    "language",
    "topic",
    "lastVerified",
    "content"
]

def validate_document(doc: dict) -> bool:
    """Validates document structure against production schema."""
    for field in REQUIRED_FIELDS:
        if field not in doc or not doc[field]:
            logger.error(f"Validation failed: Missing required field '{field}' in document: {doc.get('sourceId', 'unknown')}")
            return False
    
    # Check for unauthorized or fake sources
    allowed_org_keywords = ["World Health Organization", "WHO", "Ministry of Health", "MoHFW", "National Health Mission", "NHM", "CDC", "MedlinePlus", "NHS"]
    org = doc.get("organization", "")
    if not any(kw in org for kw in allowed_org_keywords):
        logger.warning(f"Warning: Organization '{org}' is not in primary authoritative list.")
    
    return True

def ingest_file(file_path: str):
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return

    with open(file_path, "r", encoding="utf-8") as f:
        docs = json.load(f)

    if not isinstance(docs, list):
        docs = [docs]

    logger.info(f"Validating and ingesting {len(docs)} documents from {file_path}...")
    valid_docs = []
    for doc in docs:
        if validate_document(doc):
            valid_docs.append(doc)

    logger.info(f"{len(valid_docs)} of {len(docs)} documents passed schema validation.")

    # Firestore synchronization
    db = get_firestore_client()
    if db:
        for doc in valid_docs:
            doc_id = doc["sourceId"]
            db.collection("medical_knowledge_base").document(doc_id).set(doc, merge=True)
            logger.info(f"  [✓] Ingested document to Firestore: medical_knowledge_base/{doc_id}")
    else:
        logger.info("Firestore client not available (offline/local mode). Documents validated for local cache.")

if __name__ == "__main__":
    sources_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "medical_knowledge", "authoritative_sources.json")
    ingest_file(sources_path)
