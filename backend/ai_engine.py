import os
import json
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

class ConversationalAIEngine:
    def __init__(self, knowledge_base_path: str = "data/knowledge_base.json"):
        if not GEMINI_API_KEY or GEMINI_API_KEY == "your_actual_gemini_api_key_here":
            raise ValueError("GEMINI_API_KEY is not set. Please add your key to backend/.env")
        
        self.client = genai.Client(api_key=GEMINI_API_KEY)
        self.model_name = "gemini-2.5-flash"
        self.knowledge_base = self._load_knowledge_base(knowledge_base_path)

    def _load_knowledge_base(self, path: str) -> str:
        candidates = [path, f"../{path}"]
        for p in candidates:
            if os.path.exists(p):
                with open(p, "r", encoding="utf-8") as f:
                    return json.dumps(json.load(f), ensure_ascii=False)
        return "[]"

    def _build_system_instruction(self) -> str:
        return f"""
You are 'VaniSetu', an intelligent educational and government schemes assistant for Rajasthan public education.
Your goal is to assist students, parents, and rural citizens navigating complex scholarships, admissions, and rules.

STRICT CONSTRAINTS & BEHAVIOR:
1. Ground your answers strictly on this knowledge base:
{self.knowledge_base}
2. Supported regional output languages:
   - 'hi': Hindi (Devanagari script)
   - 'mr': Marathi (Devanagari script)
   - 'gu': Gujarati (Gujarati script)
   - 'en': English
3. The user may submit queries in voice-transcribed scripts, formal regional languages, or colloquial romanized forms (Hinglish/Marathlish).
4. Always answer clearly and concisely in the requested target language.
5. If the requested information is not present in the verified schemes list, politely advise the user to check their local District Education Office or 'hte.rajasthan.gov.in' rather than guessing.
6. Provide structured bullet points with eligibility, documents required, and deadlines so speech synthesizers can narrate smoothly.
"""

    async def generate_chat_response(self, user_query: str, target_lang: str = "hi", history: list = None) -> str:
        system_instruction = self._build_system_instruction()
        prompt = f"""
Target Language: {target_lang}
User Query: {user_query}

Respond directly to the user in the target language specified. Ensure the tone is clear, accessible, and supportive.
"""
        response = self.client.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
            )
        )
        return response.text

    def generate_chat_response_stream(self, user_query: str, target_lang: str = "hi", history: list = None):
        system_instruction = self._build_system_instruction()
        prompt = f"Target Language: {target_lang}\nUser Query: {user_query}\n"
        
        return self.client.models.generate_content_stream(
            model=self.model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
            )
        )