import os
import json
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict

from ai_engine import ConversationalAIEngine

app = FastAPI(
    title="VaniSetu - Multilingual Educational Chatbot API",
    version="1.0.0",
    description="Backend API powered by Google Gemini for SIH 2026 (Problem Statement: SIH25104)"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ai_engine = ConversationalAIEngine()

class ChatRequest(BaseModel):
    query: str = Field(..., example="Rajasthan scholarship yojana ki patrata kya hai?")
    language: str = Field(default="hi", example="hi", description="Target language: hi, mr, gu, en")
    conversation_history: Optional[List[Dict[str, str]]] = Field(default=[])

class ChatResponse(BaseModel):
    success: bool
    query: str
    target_language: str
    response_text: str

@app.get("/")
def root():
    return {
        "project": "VaniSetu",
        "status": "Operational",
        "team": "AlgoRhythmics",
        "hackathon": "Smart India Hackathon 2026"
    }

@app.get("/api/health")
def health():
    return {"status": "healthy", "service": "fastapi-gemini-orchestrator"}

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest):
    if not payload.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    try:
        reply = await ai_engine.generate_chat_response(
            user_query=payload.query,
            target_lang=payload.language,
            history=payload.conversation_history
        )
        return ChatResponse(
            success=True,
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

    async def event_generator():
        try:
            stream = ai_engine.generate_chat_response_stream(
                user_query=payload.query,
                target_lang=payload.language,
                history=payload.conversation_history
            )
            for chunk in stream:
                if chunk.text:
                    data = json.dumps({"delta": chunk.text})
                    yield f"data: {data}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            error_data = json.dumps({"error": str(e)})
            yield f"data: {error_data}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("app:app", host=host, port=port, reload=True)