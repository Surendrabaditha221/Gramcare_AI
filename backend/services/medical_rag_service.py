"""
Medical RAG (Retrieval-Augmented Generation) Service for GramCare AI
Retrieves relevant medical guidelines strictly from authoritative, trusted health sources:
- World Health Organization (WHO)
- Ministry of Health and Family Welfare (MoHFW), Government of India
- National Health Mission (NHM), India
- Centers for Disease Control and Prevention (CDC) / MedlinePlus

Enforces strict relevance thresholds, source transparency, citation tracking,
and zero data fabrication.
"""
import os
import json
import logging
import re
from typing import List, Dict, Any, Optional
from datetime import datetime

logger = logging.getLogger("gramcare.medical_rag")

KNOWLEDGE_BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "medical_knowledge")
AUTHORITATIVE_SOURCES_PATH = os.path.join(KNOWLEDGE_BASE_DIR, "authoritative_sources.json")

# Multilingual medical keywords to core concepts mapping
CONCEPT_KEYWORD_MAP: Dict[str, List[str]] = {
    "fever": [
        "fever", "temperature", "febrile", "hot body", "pyrexia", "chills", "paracetamol",
        "జ్వరం", "ఉష్ణోగ్రత", "చలిజ్వరం", "బుఖార్", "ताप", "बुखार", "சுரம்", "காய்ச்சல்", "ಜ್ವರ", "പനി"
    ],
    "dehydration": [
        "dehydration", "dehydrated", "ors", "oral rehydration", "fluids", "water intake", "dry mouth",
        "sunken eyes", "thirst", "electrolyte", "heat exhaustion", "sunstroke", "diarrhea", "loose motion", "vomiting",
        "డీహైడ్రేషన్", "నీరసం", "దాహం", "ఒఆర్ఎస్", "ఓఆర్ఎస్", "విరేచనాలు", "వాంతులు",
        "निर्जलीकरण", "पानी की कमी", "दस्त", "उल्टी", "ओआरएस", "நீரிழப்பு", "വയറിളക്കം"
    ],
    "cough": [
        "cough", "cold", "throat", "phlegm", "sore throat", "respiratory", "bronchitis", "chest indrawing",
        "దగ్గు", "జలుబు", "గొంతు నొప్పి", "కఫం", "खांसी", "जुकाम", "गले में खराश", "இருமல்", "ಕೆಮ್ಮು", "ചുമ"
    ],
    "headache": [
        "headache", "head pain", "migraine", "temple pain", "tension headache",
        "తలనొప్పి", "తలపోటు", "सिरदर्द", "தலைவலி", "ತಲೆನೋವು", "തലവേദന"
    ]
}


class MedicalRAGService:
    _cached_sources: Optional[List[Dict[str, Any]]] = None

    @classmethod
    def load_knowledge_base(cls) -> List[Dict[str, Any]]:
        """
        Loads trusted medical sources from local storage or Firestore collection `medical_knowledge_base`.
        """
        if cls._cached_sources is not None:
            return cls._cached_sources

        sources = []
        # 1. Attempt load from local authoritative JSON file
        if os.path.exists(AUTHORITATIVE_SOURCES_PATH):
            try:
                with open(AUTHORITATIVE_SOURCES_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        sources = data
                        logger.info(f"Loaded {len(sources)} authoritative medical guidelines from local store.")
            except Exception as e:
                logger.warning(f"Failed to read local authoritative medical sources: {e}")

        # 2. Attempt Firestore load if available
        try:
            from services.firebase_admin import get_firestore_client
            db = get_firestore_client()
            if db:
                kb_ref = db.collection("medical_knowledge_base").stream()
                fs_sources = [doc.to_dict() for doc in kb_ref if doc.exists]
                if fs_sources:
                    # Merge or use Firestore sources
                    existing_ids = {s.get("sourceId") for s in sources}
                    for fs_doc in fs_sources:
                        if fs_doc.get("sourceId") not in existing_ids:
                            sources.append(fs_doc)
        except Exception as fs_err:
            logger.debug(f"Firestore medical_knowledge_base check: {fs_err}")

        cls._cached_sources = sources
        return sources

    @classmethod
    def normalize_query(cls, query: str) -> Dict[str, Any]:
        """
        Normalizes query tokens and extracts underlying clinical concepts across supported languages.
        """
        cleaned = query.lower().strip()
        matched_concepts = []

        for concept, kw_list in CONCEPT_KEYWORD_MAP.items():
            if any(kw in cleaned for kw in kw_list):
                matched_concepts.append(concept)

        tokens = set(re.findall(r'\b\w+\b', cleaned))
        return {
            "raw_query": query,
            "cleaned_query": cleaned,
            "matched_concepts": matched_concepts,
            "tokens": tokens
        }

    @classmethod
    def retrieve_relevant_sources(
        cls,
        query: str,
        language: str = "en",
        top_k: int = 2,
        relevance_threshold: float = 0.25
    ) -> List[Dict[str, Any]]:
        """
        Retrieves top-k relevant trusted medical documents matching query concepts.
        Enforces relevance threshold: if no source is sufficiently relevant, returns an empty list.
        """
        sources = cls.load_knowledge_base()
        if not sources:
            return []

        norm = cls.normalize_query(query)
        matched_concepts = set(norm["matched_concepts"])
        tokens = norm["tokens"]

        scored_sources = []
        for src in sources:
            score = 0.0
            src_tags = set([t.lower() for t in src.get("tags", [])])
            src_topic = src.get("topic", "").lower()
            src_content = src.get("content", "").lower()
            src_title = src.get("title", "").lower()

            # 1. Concept match bonus
            for concept in matched_concepts:
                if concept in src_tags or concept in src_topic:
                    score += 0.5
                if concept in src_title:
                    score += 0.3
                if concept in src_content:
                    score += 0.2

            # 2. Token overlap score
            overlap_count = 0
            for tok in tokens:
                if len(tok) > 2 and (tok in src_tags or tok in src_title or tok in src_topic):
                    overlap_count += 1
            if overlap_count > 0:
                score += min(0.4, overlap_count * 0.1)

            if score >= relevance_threshold:
                scored_sources.append({
                    "score": round(score, 3),
                    "source": src
                })

        # Rank by relevance score descending
        scored_sources.sort(key=lambda x: x["score"], reverse=True)
        top_results = [item["source"] for item in scored_sources[:top_k]]
        return top_results

    @classmethod
    def format_sources_for_prompt(cls, sources: List[Dict[str, Any]]) -> str:
        """
        Formats retrieved medical knowledge into a clean, separated prompt section for Gemini.
        """
        if not sources:
            return "No specific external medical guideline retrieved from knowledge base."

        formatted = ""
        for i, src in enumerate(sources, 1):
            title = src.get("title", "Clinical Guideline")
            org = src.get("organization", "Authoritative Health Organization")
            url = src.get("url", "")
            content = src.get("content", "")
            formatted += f"Source [{i}]: {title}\n"
            formatted += f"Organization: {org}\n"
            if url:
                formatted += f"Official URL: {url}\n"
            formatted += f"Verified Guidance: {content}\n\n"

        return formatted.strip()

    @classmethod
    def format_citations_text(cls, sources: List[Dict[str, Any]], language: str = "en") -> str:
        """
        Builds transparent citation lines to append to user-facing responses when sources were used.
        """
        if not sources:
            return ""

        headers = {
            "te": "\n\nఆధారాలు (Trusted Sources):",
            "hi": "\n\nस्रोतः (Trusted Sources):",
            "ta": "\n\nஆதாரங்கள் (Trusted Sources):",
            "kn": "\n\nಮೂಲಗಳು (Trusted Sources):",
            "ml": "\n\nഉറവിടങ്ങൾ (Trusted Sources):",
            "en": "\n\nSources:"
        }
        header_text = headers.get(language, headers["en"])
        citations = [header_text]

        for src in sources:
            org = src.get("organization", "Health Organization")
            title = src.get("title", "Clinical Guideline")
            url = src.get("url", "")
            if url:
                citations.append(f"• {org} — {title} ({url})")
            else:
                citations.append(f"• {org} — {title}")

        return "\n".join(citations)
