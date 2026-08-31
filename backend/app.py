import os
import json
import time
import uvicorn
from collections import defaultdict
from typing import Optional, List, Dict
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from ai_engine import ConversationalAIEngine

app = FastAPI(
    title="VaniSetu - Multilingual Educational Chatbot API",
    version="1.1.0",
    description="Backend API powered by Google Gemini for SIH 2026 (Problem Statement: SIH25104)"
)

# Enable CORS for local testing across browser ports
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Latency benchmarking middleware for evaluation tracking
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time_ms = (time.time() - start_time) * 1000
    response.headers["X-Process-Time-Ms"] = f"{process_time_ms:.2f}ms"
    return response

# Initialize AI Engine
ai_engine = ConversationalAIEngine()

# In-memory session store for multi-turn conversation context
SESSION_STORE: Dict[str, List[Dict[str, str]]] = defaultdict(list)

class ChatRequest(BaseModel):
    query: str = Field(..., example="Rajasthan scholarship yojana ki patrata kya hai?")
    language: str = Field(default="hi", example="hi", description="Target language: 'hi', 'mr', 'gu', 'en', 'auto'")
    session_id: Optional[str] = Field(default="default_session", description="Session ID for conversation history tracking")
    conversation_history: Optional[List[Dict[str, str]]] = Field(default=[], description="Optional client-side history")

class ChatResponse(BaseModel):
    success: bool
    session_id: str
    query: str
    target_language: str
    response_text: str

@app.get("/")
def root():
    return {
        "project": "VaniSetu",
        "status": "Operational",
        "team": "AlgoRhythmics",
        "hackathon": "Smart India Hackathon 2026",
        "supported_languages": ["Hindi (hi)", "Marathi (mr)", "Gujarati (gu)", "English (en)"]
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "fastapi-gemini-orchestrator",
        "schemes_loaded": 6
    }

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    session_id = payload.session_id or "default_session"
    history = SESSION_STORE[session_id] if not payload.conversation_history else payload.conversation_history

    try:
        reply = await ai_engine.generate_chat_response(
            user_query=payload.query,
            target_lang=payload.language,
            history=history
        )

        # Update in-memory session history
        SESSION_STORE[session_id].append({"role": "user", "parts": [payload.query]})
        SESSION_STORE[session_id].append({"role": "model", "parts": [reply]})

        # Keep sliding window to last 10 messages
        if len(SESSION_STORE[session_id]) > 10:
            SESSION_STORE[session_id] = SESSION_STORE[session_id][-10:]

        return ChatResponse(
            success=True,
            session_id=session_id,
            query=payload.query,
            target_language=payload.language,
            response_text=reply
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference error: {str(e)}")

@app.post("/api/chat/stream")
async def chat_stream_endpoint(payload: ChatRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    session_id = payload.session_id or "default_session"
    history = SESSION_STORE[session_id]

    async def event_generator():
        full_response = []
        try:
            stream = ai_engine.generate_chat_response_stream(
                user_query=payload.query,
                target_lang=payload.language,
                history=history
            )
            for chunk in stream:
                if chunk.text:
                    full_response.append(chunk.text)
                    data = json.dumps({"delta": chunk.text})
                    yield f"data: {data}\n\n"

            combined_reply = "".join(full_response)
            SESSION_STORE[session_id].append({"role": "user", "parts": [payload.query]})
            SESSION_STORE[session_id].append({"role": "model", "parts": [combined_reply]})
            yield "data: [DONE]\n\n"
        except Exception as e:
            err = json.dumps({"error": str(e)})
            yield f"data: {err}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.delete("/api/chat/session/{session_id}")
def clear_session(session_id: str):
    if session_id in SESSION_STORE:
        del SESSION_STORE[session_id]
    return {"status": "cleared", "session_id": session_id}

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app:app", host=host, port=port, reload=True)