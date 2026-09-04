import os
import json
import asyncio
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Import your AI engine logic
from ai_engine import get_ai_response_stream

load_dotenv()

app = FastAPI(title="VaniSetu Multilingual Assistant API")

# Allow unrestricted CORS for production Vercel frontend and local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    language: str = "hi"
    mode: str = "text-text"

@app.get("/")
async def root():
    return {
        "status": "active",
        "service": "VaniSetu Multilingual Assistant"
    }

@app.post("/api/chat/stream")
async def chat_stream_endpoint(request: ChatRequest):
    if not request.message or not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    async def event_generator():
        try:
            # Yield chunks directly from the ai_engine generator
            for chunk in get_ai_response_stream(
                prompt=request.message,
                language=request.language,
                mode=request.mode
            ):
                if chunk:
                    yield f"data: {json.dumps({'text': chunk})}\n\n"
                    await asyncio.sleep(0.01)
            
            # Send standard SSE terminal signal
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
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