import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional

from ai_engine import generate_response, generate_response_stream

app = FastAPI(
    title="VaniSetu API",
    description="Multilingual Voice & Text RAG Backend for SIH 2026",
    version="2.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User's query string")
    language: str = Field(default="hi", description="Language code: hi, mr, gu, en")
    session_id: Optional[str] = Field(default="default_session")
    mode: Optional[str] = Field(default="S2S", description="One of: T2T, S2S, T2S, S2T")

@app.get("/")
def health_check():
    return {"status": "active", "service": "VaniSetu Multilingual Assistant"}

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
                payload = json.dumps({"delta": token})
                yield f"data: {payload}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            err_payload = json.dumps({"error": str(e)})
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