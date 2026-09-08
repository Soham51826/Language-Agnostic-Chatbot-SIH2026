import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

from ai_engine import (
    generate_response, 
    generate_response_stream, 
    SCHEMES_LIST,
    GEMINI_API_KEY
)

app = FastAPI(
    title="वाणीसेतु (VaniSetu) API",
    description="Universal Multilingual Voice & Text Educational Assistant for Smart India Hackathon (SIH) 2026",
    version="2.1.0"
)

# Strict and flexible CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User query string in Hindi, Marathi, Gujarati, English or Hinglish")
    language: str = Field(default="hi", description="Language code: hi, mr, gu, en")
    session_id: Optional[str] = Field(default="vanisetu_session")
    mode: Optional[str] = Field(default="S2S", description="Interaction mode: T2T, S2S, T2S, S2T")

@app.get("/")
def health_check():
    return {
        "status": "active",
        "service": "वाणीसेतु (VaniSetu) Multilingual Educational Assistant",
        "version": "2.1.0",
        "sih_verified": True,
        "schemes_loaded": len(SCHEMES_LIST)
    }

@app.get("/api/status")
def status_endpoint():
    return {
        "status": "online",
        "gemini_api_configured": bool(GEMINI_API_KEY),
        "primary_model": "gemini-3.6-flash",
        "local_rag_active": True,
        "schemes_count": len(SCHEMES_LIST),
        "languages": ["hi", "mr", "gu", "en"],
        "modes": ["T2T", "S2S", "T2S", "S2T"]
    }

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        response_text = await generate_response(
            query=request.query, 
            language=request.language, 
            mode=request.mode
        )
        return {
            "success": True,
            "response_text": response_text,
            "language": request.language,
            "mode": request.mode
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    async def sse_event_generator():
        try:
            async for token in generate_response_stream(
                query=request.query, 
                language=request.language, 
                mode=request.mode
            ):
                payload = json.dumps({"delta": token}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            err_payload = json.dumps({"error": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n"

    return StreamingResponse(
        sse_event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)