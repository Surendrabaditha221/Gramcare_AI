# GramCare AI — Rural Health Companion & Multilingual Symptom Triage

GramCare AI is a production-grade digital healthcare platform engineered specifically for rural and semi-urban communities. It bridges critical primary healthcare gaps through voice-first multilingual interaction, AI-driven symptom triage grounded in verified medical knowledge, and emergency assistance workflows.

---

## 🌟 Key Features

- **Multilingual & Voice-First**: Natural voice interaction in Indian regional languages (Hindi, Telugu, Tamil, Kannada, Bengali, Marathi, etc.) with real-time Speech-to-Text and Text-to-Speech support.
- **AI Symptom Triage (Gemini + RAG)**: Structured clinical triage with medical RAG grounded in verified clinical knowledge bases (WHO, MOHFW, CDC).
- **Nearby Verified Healthcare Centers**: Real-time discovery of primary health centres (PHCs), community health centres (CHCs), and hospitals with distance calculations and navigation links.
- **Offline & Low-Bandwidth Resilience**: Robust local caching with seamless synchronization once connectivity is restored.
- **Private & Secure**: Client-side and server-side authentication using Firebase Authentication and Cloud Firestore security rules with granular access controls.

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind-compatible CSS design system, Lucide icons
- **Backend**: Python 3.12, FastAPI, Uvicorn, Google Gemini API (`google-genai`), Firebase Admin SDK
- **Database & Security**: Cloud Firestore (`asia-south2`), strict security rules
- **Auth**: Firebase Authentication (Google OAuth & Email/Password)
- **Deployment**: Firebase Hosting (Frontend) & Render Web Service (Backend)

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v18+)
- Python (v3.11 or v3.12)
- Firebase CLI (`npm install -g firebase-tools`)

### 2. Frontend Setup
```bash
npm install
cp .env.example .env
npm run dev
```

### 3. Backend Setup
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate   # On Windows (or source venv/bin/activate on Linux/Mac)
pip install -r requirements.txt
cp .env.example .env
python main.py
```

---

## 📦 Deployment

- **Backend (Render)**: Automatically builds using `render.yaml` with root directory `backend`.
- **Frontend (Firebase Hosting)**:
  ```bash
  npm run build
  firebase deploy --only hosting
  ```
