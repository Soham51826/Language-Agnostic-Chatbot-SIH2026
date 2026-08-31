import os
import json
from typing import List, Dict, Generator
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

class ConversationalAIEngine:
    def __init__(self, knowledge_base_path: str = "data/knowledge_base.json"):
        if not GEMINI_API_KEY or GEMINI_API_KEY == "your_actual_gemini_api_key_here":
            raise ValueError("GEMINI_API_KEY is not set. Please update backend/.env")
        
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
Your goal is to assist students, parents, and rural citizens navigating complex scholarships, admissions, and educational rules.

STRICT CONSTRAINTS & BEHAVIOR:
1. Ground your answers strictly on this knowledge base:
{self.knowledge_base}
2. Language Support:
   - 'hi': Hindi (Devanagari script)
   - 'mr': Marathi (Devanagari script)
   - 'gu': Gujarati (Gujarati script)
   - 'en': English
   - 'auto': Automatically detect the user's input language/script.
3. Romanized Script Handling:
   - If the user types in colloquial Romanized text (e.g., Hinglish like 'mujhe scholarship chahiye', Marathlish, or Gujlish), reply in the native regional script (Devanagari/Gujarati) followed by a short simplified Romanized explanation.
4. Hallucination Prevention:
   - If the requested scheme or information is not present in the verified knowledge base, do not guess or fabricate information. Politely direct the user to their local District Education Office or official portal 'hte.rajasthan.gov.in'.
5. Formatting:
   - Always structure responses with clean bullet points for eligibility, benefits, and required documents so Text-to-Speech (TTS) synthesizers can narrate cleanly.
"""

    def _format_contents(self, user_query: str, target_lang: str, history: List[Dict[str, str]] = None) -> list:
        contents = []
        if history:
            for turn in history:
                role = "user" if turn.get("role") == "user" else "model"
                text = turn.get("parts", [""])[0] if isinstance(turn.get("parts"), list) else str(turn.get("parts", ""))
                contents.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))

        query_instruction = f"Target Language: {target_lang}\nUser Query: {user_query}\nAnswer directly in the requested language."
        contents.append(types.Content(role="user", parts=[types.Part.from_text(text=query_instruction)]))
        return contents

    async def generate_chat_response(self, user_query: str, target_lang: str = "hi", history: List[Dict[str, str]] = None) -> str:
        system_instruction = self._build_system_instruction()
        contents = self._format_contents(user_query, target_lang, history)

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
            )
        )
        return response.text

    def generate_chat_response_stream(self, user_query: str, target_lang: str = "hi", history: List[Dict[str, str]] = None) -> Generator:
        system_instruction = self._build_system_instruction()
        contents = self._format_contents(user_query, target_lang, history)

        return self.client.models.generate_content_stream(
            model=self.model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                temperature=0.3,
            )
        )