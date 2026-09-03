import os
import json
import asyncio
from typing import AsyncGenerator
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is missing.")

client = genai.Client(api_key=GEMINI_API_KEY)

# Load Knowledge Base
KB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "knowledge_base.json")
try:
    with open(KB_PATH, "r", encoding="utf-8") as f:
        KNOWLEDGE_BASE = json.load(f)
except Exception as e:
    print(f"Warning: Could not load knowledge base from {KB_PATH}: {e}")
    KNOWLEDGE_BASE = []

def build_system_instruction(target_lang: str, mode: str = "S2S") -> str:
    lang_map = {
        "hi": "Hindi (हिंदी)",
        "mr": "Marathi (मराठी)",
        "gu": "Gujarati (ગુજરાતી)",
        "en": "English"
    }
    lang_name = lang_map.get(target_lang, "Hindi")

    voice_mode_rules = ""
    if mode in ["S2S", "T2S"]:
        voice_mode_rules = """
- MODE IS SPEECH-OUTPUT: The user will LISTEN to your output via Text-to-Speech.
- DO NOT use markdown headers, asterisks, bullet dashes, or raw URLs.
- Keep sentences short, conversational, and direct so speech synthesis sounds natural.
- Avoid brackets and special characters.
"""
    else:
        voice_mode_rules = """
- MODE IS TEXT-OUTPUT: The user will READ your output on screen.
- Use clear bullet points, bold key requirements, and structured lists for readability.
"""

    return f"""
You are VaniSetu, an intelligent multilingual educational assistant for Rajasthan Government Scholarship & Admission Schemes for SIH 2026.

TARGET LANGUAGE: {lang_name}
All responses MUST be entirely generated in {lang_name}.

GROUND TRUTH SCHEMES DATA:
{json.dumps(KNOWLEDGE_BASE, ensure_ascii=False, indent=2)}

STRICT GUARDRAILS:
1. Rely ONLY on the verified schemes provided above.
2. If the user asks about an unknown scheme or fake scheme, explicitly decline in {lang_name} and advise them to visit the official Rajasthan portal (hte.rajasthan.gov.in) or their District Education Office.
3. Handle colloquial or Romanized transliterations (Hinglish/Marathlish) naturally by detecting the intent and responding in {lang_name}.
{voice_mode_rules}
"""

async def generate_response(query: str, language: str = "hi", mode: str = "S2S") -> str:
    system_prompt = build_system_instruction(language, mode)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=query,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2,
        ),
    )
    return response.text

async def generate_response_stream(query: str, language: str = "hi", mode: str = "S2S") -> AsyncGenerator[str, None]:
    system_prompt = build_system_instruction(language, mode)
    response_stream = client.models.generate_content_stream(
        model="gemini-2.5-flash",
        contents=query,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.2,
        ),
    )
    for chunk in response_stream:
        if chunk.text:
            yield chunk.text
            await asyncio.sleep(0.01)