🔄 Warm Transfer Implementation

A real-time warm transfer system built with LiveKit, Next.js, Python (FastAPI), and AI-powered summarization (OpenAI LLMs).
This project implements smooth agent-to-agent handoff with context preservation, transcription, and call summarization.

📂 GitHub Repository: Warm-Transfer-Implementation

🎥 Demo Video: Watch Loom Demo

🚀 Features

✅ Seamless Warm Transfer (Agent A → Agent B) with context

✅ Real-time Video & Audio using LiveKit

✅ Speech-to-Text Transcription via Web Speech API

✅ AI-Powered Call Summaries (OpenAI GPT models)

✅ Agent Briefing with intelligent summaries before handoff

✅ Professional UI with mute/video toggle and live transcript

✅ Complete 3-Stage Workflow:

Customer + Agent A

Customer + Agent A + Agent B (briefing)

Customer + Agent B

🛠️ Tech Stack

Frontend: Next.js 14, React, Tailwind CSS, LiveKit Components

Backend: FastAPI, Python 3.11, SQLAlchemy

Real-Time Infra: LiveKit Cloud (or self-hosted)

AI/LLM: OpenAI GPT-3.5 / GPT-4 for summarization

Speech Recognition: Browser-native Web Speech API

Database: PostgreSQL (can also use SQLite locally)

📋 Prerequisites

Before running the project, make sure you have:

Node.js 18+

Python 3.11+

LiveKit Cloud account (for API key & secret)

OpenAI API key (or other LLM provider)

PostgreSQL database (local or cloud)

Redis server (optional, for caching)

🔧 Setup Instructions
1. Clone the Repository
git clone https://github.com/Vyshnavi-Lenkalapelly/Warm-Transfer-Implementation.git
cd Warm-Transfer-Implementation

2. Backend Setup
cd backend
python -m venv venv
# Activate venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt

3. Frontend Setup
cd frontend
npm install

4. Environment Variables

Create .env files for backend and frontend.

Backend (.env)

LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
OPENAI_API_KEY=your_openai_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/warmtransfer


Frontend (.env.local)

NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server-url
NEXT_PUBLIC_API_BASE=http://localhost:8000

5. Database Setup
cd backend
python scripts/init_db.py

🚀 Running the Application
Development Mode
# Terminal 1 - Backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev

# (Optional) If self-hosting LiveKit
livekit-server --dev

Production Mode
# Build frontend
cd frontend
npm run build

# Run services
docker-compose up -d

🔄 Warm Transfer Workflow

Agent A joins call with customer

Recording starts – real-time speech-to-text begins

AI listens and generates live transcript

Agent A clicks "Transfer" – system summarizes conversation

Agent B joins with AI-generated context briefing

Agent A leaves – customer continues smoothly with Agent B

graph TD
    A[Caller Joins] --> B[Agent A Connected]
    B --> C{Transfer Initiated?}
    C -->|Yes| D[Create Transfer Room]
    D --> E[Generate AI Summary]
    E --> F[Agent B Joins]
    F --> G[Agent A Shares Context]
    G --> H[Agent A Leaves]
    H --> I[Caller + Agent B Continue]
    C -->|No| J[Continue with Agent A]

📖 Usage

Access call interface:
http://localhost:3000/call?identity=Agent1&room=test-room

Demo page:
http://localhost:3000/demo

API test page:
http://localhost:3000/test.html

📊 Monitoring & Analytics (Planned Enhancements)

Call metrics and transfer success rate

Agent performance dashboard

Sentiment analysis on live transcripts

Recording & playback support

🧪 Testing
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm test