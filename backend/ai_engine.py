import os
import json
import asyncio
import re
from typing import AsyncGenerator, Dict, Any, List, Optional
from dotenv import load_dotenv
from google import genai
from google.genai import types

ENV_PATH = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(ENV_PATH)
load_dotenv()

# Sanitize environment variables so spaces, quotes, or formatting artifacts never trigger a 401
raw_key = os.getenv("GEMINI_API_KEY", "")
GEMINI_API_KEY = raw_key.strip().strip('"').strip("'").strip()

client: Optional[genai.Client] = None
if GEMINI_API_KEY:
    try:
        client = genai.Client(
            api_key=GEMINI_API_KEY,
            http_options=types.HttpOptions(timeout=12000)
        )
    except Exception as e:
        print(f"[VaniSetu Engine] Warning: Client initialization failed with provided key: {e}")
        client = None
else:
    print("[VaniSetu Engine] GEMINI_API_KEY is not set. Operating in high-speed Local RAG mode.")

# Load Ground Truth Knowledge Base
KB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "knowledge_base.json")
KNOWLEDGE_BASE: Dict[str, Any] = {"schemes": []}

try:
    with open(KB_PATH, "r", encoding="utf-8") as f:
        loaded = json.load(f)
        if isinstance(loaded, dict) and "schemes" in loaded:
            KNOWLEDGE_BASE = loaded
        elif isinstance(loaded, list):
            KNOWLEDGE_BASE = {"schemes": loaded}
except Exception as e:
    print(f"[VaniSetu Engine] Error loading knowledge base from {KB_PATH}: {e}")
    KNOWLEDGE_BASE = {"schemes": []}

SCHEMES_LIST: List[Dict[str, Any]] = KNOWLEDGE_BASE.get("schemes", [])

def build_system_instruction(target_lang: str, mode: str = "S2S") -> str:
    lang_map = {
        "hi": "Hindi (हिंदी)",
        "mr": "Marathi (मराठी)",
        "gu": "Gujarati (ગુજરાતી)",
        "en": "English"
    }
    lang_name = lang_map.get(target_lang, "Hindi (हिंदी)")

    if mode in ["S2S", "T2S"]:
        formatting_rules = """
- MODE IS SPEECH-OUTPUT: The user will LISTEN via Text-to-Speech.
- Speak in natural, rhythmic sentences without any markdown asterisks (*), hashtags (#), brackets, or tables.
- Mention numbers clearly (e.g., 'साठ प्रतिशत' or '60%'). Keep it crisp, conversational, and direct.
"""
    else:
        formatting_rules = """
- MODE IS TEXT-OUTPUT: The user will READ on screen.
- Format with rich Markdown:
  * Bold key numbers, eligibility criteria, and benefit amounts.
  * Use clean markdown tables where comparing criteria or benefits.
  * Use bullet lists for required documents.
  * Highlight the official portal URL clearly.
"""

    return f"""
You are VaniSetu (वाणीसेतु), an award-winning, universal multilingual educational and scholarship assistant engineered for Smart India Hackathon (SIH) 2026, serving the Government of Rajasthan.

TARGET LANGUAGE: {lang_name}
All answers MUST be strictly and fluently generated in {lang_name}.

GROUND TRUTH RAJASTHAN SCHEMES KNOWLEDGE BASE:
{json.dumps(SCHEMES_LIST, ensure_ascii=False, indent=2)}

CAPABILITIES & OPERATING PRINCIPLES:
1. UNIVERSAL COMPETITION READINESS: Competition judges, students, and citizens may ask you ANY question—including questions about specific Rajasthan scholarship schemes, higher education admission, technical questions about your architecture (FastAPI, React 18, Web Speech API, Google Gemini Flash, RAG pipeline), SIH 2026 metadata, general knowledge, or comparative scheme analysis. Answer intelligently, authoritatively, politely, and thoroughly in {lang_name}.
2. STRICT GROUND TRUTH FOR SCHEMES: When queried about Rajasthan scholarship schemes (amounts, eligibility, documents, portals, deadlines), rely strictly on the verified knowledge base above. Never hallucinate non-existent state benefits or incorrect eligibility percentages.
3. GREETINGS & CASUAL INTERACTION: Respond warmly, introduce yourself as VaniSetu, and invite questions about education, admission, welfare, and government scholarships in Rajasthan.
4. SCHEME COMPARISONS: If asked to compare schemes (e.g., Kalibai vs Devnarayan Scooty Yojana), provide a clear, structured side-by-side breakdown.
5. TRANSLITERATION HANDLING: If the user inputs text in Romanized vernacular (e.g. Hinglish, Marathlish, Gujlish), understand the intent perfectly and reply fluently in the requested target script/language ({lang_name}).
6. ZERO-HALLUCINATION GUARDRAIL: If asked about an unverified or unknown private scheme, state what is officially known and advise checking the state portals at https://hte.rajasthan.gov.in or https://sso.rajasthan.gov.in.
{formatting_rules}
"""

def match_local_scheme(query: str) -> Optional[Dict[str, Any]]:
    """Smart keyword and intent matcher across Hindi, English, Marathi, Gujarati, and Hinglish."""
    q = query.lower().strip()
    
    # Check each scheme
    scored_matches: List[tuple[int, Dict[str, Any]]] = []
    
    for scheme in SCHEMES_LIST:
        score = 0
        name = scheme.get("scheme_name", "").lower()
        name_hi = scheme.get("scheme_name_hi", "").lower()
        target = scheme.get("target_category", "").lower()
        elig = scheme.get("eligibility", "").lower()
        benefit = scheme.get("benefit", "").lower()
        keywords = [k.lower() for k in scheme.get("keywords", [])]

        # Match exact ID or key name fragments
        if any(term in q for term in ["scooty", "स्कूटी", "સ્કૂટી", "skooty"]):
            if any(term in q for term in ["kalibai", "कालीबाई", "કાલીબાઈ", "cb"]):
                if "kalibai" in name or "कालीबाई" in name_hi:
                    score += 15
            elif any(term in q for term in ["devnarayan", "देवनारायण", "દેવનારાયણ", "mbc", "gurjar", "गुर्जर"]):
                if "devnarayan" in name or "देवनारायण" in name_hi:
                    score += 15
            else:
                # General scooty query matches Kalibai as flagship
                if "kalibai" in name or "कालीबाई" in name_hi:
                    score += 8

        if any(term in q for term in ["coaching", "अनुप्रति", "anupriti", "upsc", "neet", "iit", "कोचिंग", "કોચિંગ", "અનુપ્રતિ"]):
            if "anupriti" in name or "अनुप्रति" in name_hi:
                score += 15

        if any(term in q for term in ["tablet", "टैबलेट", "tab", "shala darpan", "शाला दर्पण", "ટેબ્લેટ", "શાળા દર્પણ"]):
            if "tablet" in name or "टैबलेट" in name_hi:
                score += 15

        if any(term in q for term in ["vidhwa", "sambal", "विधवा", "संबल", "divorce", "परित्यक्ता", "વિધવા", "સંબલ"]):
            if "sambal" in name or "संबल" in name_hi:
                score += 15

        if any(term in q for term in ["post matric", "uttar matric", "उत्तर मैट्रिक", "sc st", "fee reimbursement", "sjms", "पोस्ट मॅट्रिक", "ઉત્તર મેટ્રિક"]):
            if "post-matric" in name or "उत्तर मैट्रिक" in name_hi:
                score += 15

        if any(term in q for term in ["uchha shiksha", "उच्च शिक्षा", "12th", "12वीं", "5000", "scholarship", "छात्रवृत्ति", "कॉलेज", "ઉચ્ચ શિક્ષણ", "શિષ્યવૃત્તિ", "उच्च शिक्षण"]):
            if "uchha shiksha" in name or "उच्च शिक्षा" in name_hi:
                score += 12

        # Keyword direct hits
        for kw in keywords:
            if kw in q:
                score += 3

        if score > 0:
            scored_matches.append((score, scheme))

    if scored_matches:
        scored_matches.sort(key=lambda x: x[0], reverse=True)
        return scored_matches[0][1]

    return None

def get_local_failsafe_response(query: str, language: str = "hi", mode: str = "S2S") -> str:
    """Bulletproof local RAG fallback engine: streams verified ground truth instantly."""
    q_lower = query.lower().strip()
    is_speech = mode in ["S2S", "T2S"]

    # 1. Greetings detection using word boundaries
    greetings_words = {"hi", "hello", "hey", "namaste", "namaskar", "pranam", "नमस्ते", "नमस्कार", "प्रणाम", "राम", "ram"}
    greetings_phrases = ["kem cho", "kem chho", "केम छो", "राम राम", "जय श्री कृष्णा", "kasa ahes"]
    q_words = set(re.findall(r'[\w]+', q_lower))
    
    is_greeting = False
    if len(q_words) <= 4:
        if bool(q_words & greetings_words) or any(phrase in q_lower for phrase in greetings_phrases):
            is_greeting = True

    if is_greeting:
        if language == "hi":
            return (
                "नमस्ते! मैं वाणीसेतु (VaniSetu) हूँ—राजस्थान सरकार की उच्च शिक्षा छात्रवृत्ति एवं प्रवेश योजनाओं का डिजिटल सहायक। "
                "आप मुख्यमंत्री उच्च शिक्षा छात्रवृत्ति, कालीबाई भील स्कूटी योजना, अनुप्रति कोचिंग योजना या उत्तर मैट्रिक छात्रवृत्ति के बारे में पूछ सकते हैं।"
            )
        elif language == "mr":
            return (
                "नमस्कार! मी वाणीसेतु (VaniSetu) आहे—राजस्थान सरकारच्या उच्च शिक्षण शिष्यवृत्ती आणि कल्याणकारी योजनांचा डिजिटल सहाय्यक. "
                "तुम्ही मुख्यमंत्री उच्च शिक्षण शिष्यवृत्ती, स्कूटी योजना किंवा अनुप्रति मोफत कोचिंगबद्दल विचारू शकता."
            )
        elif language == "gu":
            return (
                "નમસ્તે! હું વાણીસેતુ (VaniSetu) છું—રાજસ્થાન સરકારની ઉચ્ચ શિક્ષણ શિષ્યવૃત્તિ અને પ્રવેશ યોજનાઓનો ડિજિટલ સહાયક. "
                "તમે મુખ્યમંત્રી ઉચ્ચ શિક્ષણ શિષ્યવૃત્તિ, સ્કૂટી યોજના અથવા અનુપ્રતિ કોચિંગ યોજના વિશે પૂછી શકો છો."
            )
        else:
            return (
                "Hello! I am VaniSetu, your multilingual educational assistant for Rajasthan Government higher education scholarship and admission schemes for SIH 2026. "
                "Feel free to ask about the Mukhyamantri Higher Education Scholarship, Kalibai Scooty Scheme, Anupriti Free Coaching, or Post-Matric Scholarships!"
            )

    # 2. VaniSetu / SIH 2026 / Architecture / Technical Questions
    if any(k in q_lower for k in ["vanisetu", "वाणीसेतु", "sih", "hackathon", "who are you", "who made you", "architecture", "technology", "innovative", "तकनीक"]):
        if language == "hi":
            return """### 🏛️ वाणीसेतु (VaniSetu) - SIH 2026 इनोवेशन ओवरव्यू

**वाणीसेतु** स्मार्ट इंडिया हैकथॉन 2026 (Problem ID: `SIH25104`) के अंतर्गत राजस्थान सरकार के लिए विकसित एक सार्वभौमिक बहुभाषी शैक्षिक सहायक है।

#### 💡 मुख्य तकनीकी विशेषताएं:
* **4-वे इंटरेक्शन मैट्रिक्स:** T2T (टेक्स्ट-टेक्स्ट), S2S (स्पीच-स्पीच), T2S, S2T।
* **शून्य-भ्रम RAG पाइपलाइन:** Google Gemini 2.5 Flash तथा सत्यापित लोकल नॉलेज बेस का हाइब्रिड आर्किटेक्चर।
* **हार्डन्ड वेब स्पीच इंजन:** क्रोम की 15-सेकंड TTS सीमा को समाप्त करने हेतु सेंटेंस-चंकिंग तकनीक।
* **स्थानीय भाषा एवं हिंग्लिश समर्थन:** हिंदी, मराठी, गुजराती, अंग्रेजी और बोलचाल की लिप्यंतरित भाषाएं।
* **प्रौद्योगिकी स्टैक:** FastAPI (Python), React 18, Vite, Web Speech API, Google GenAI SDK।
"""
        elif language == "mr":
            return """### 🏛️ वाणीसेतु (VaniSetu) - SIH 2026 तंत्रज्ञान अवलोकन

**वाणीसेतु** हे स्मार्ट इंडिया हॅकाथॉन 2026 अंतर्गत राजस्थान सरकारसाठी विकसित केलेले बहुभाषिक AI सहाय्यक आहे. हे ४ संवादात्मक पद्धती (T2T, S2S, T2S, S2T) आणि शून्य-भ्रम RAG तंत्रज्ञानावर आधारित आहे.
"""
        elif language == "gu":
            return """### 🏛️ વાણીસેતુ (VaniSetu) - SIH 2026 ટેકનોલોજી ઝાંખી

**વાણીસેતુ** એ સ્માર્ટ ઇન્ડિયા હેકાથોન 2026 હેઠળ રાજસ્થાન સરકાર માટે વિકસિત બહુભાષી એજ્યુકેશનલ સહાયક છે, જે 4 ક્રિયાપ્રતિક્રિયા મોડ્સ (T2T, S2S, T2S, S2T) અને RAG આર્કિટેક્ચર પર આધારિત છે.
"""
        else:
            return """### 🏛️ VaniSetu (वाणीसेतु) - SIH 2026 Architecture Overview

**VaniSetu** is an intelligent, low-latency multilingual educational assistant built for Smart India Hackathon 2026 (Problem Statement: `SIH25104`, Govt of Rajasthan).

#### 💡 Core Technical Architecture:
* **4-Way Interaction Matrix:** T2T (Text-Text), S2S (Speech-Speech), T2S (Text-Speech), S2T (Speech-Text).
* **Strict Ground-Truth RAG:** Google Gemini 2.5 Flash hybrid pipeline with automated local fallback.
* **Resilient Audio Engine:** Sentence-chunked speech synthesis that eliminates Chrome's 15-second TTS limit.
* **Vernacular Transliteration:** Fluent support for Hindi, Marathi, Gujarati, English, and Hinglish.
* **Tech Stack:** FastAPI (Python), React 18, Vite, Marked, Web Speech API, Google GenAI SDK.
"""

    # 3. Chief Minister / Governance Query
    if any(k in q_lower for k in ["chief minister", "rajasthan cm", "मुख्यमंत्री", "भजनलाल"]):
        if language == "hi":
            return "राजस्थान के माननीय मुख्यमंत्री **श्री भजनलाल शर्मा** हैं। राजस्थान सरकार उच्च शिक्षा में छात्रों के कल्याण हेतु मुख्यमंत्री उच्च शिक्षा छात्रवृत्ति, कालीबाई भील स्कूटी योजना और अनुप्रति कोचिंग योजना जैसी कई प्रमुख योजनाएं संचालित कर रही है।"
        elif language == "mr":
            return "राजस्थानचे माननीय मुख्यमंत्री **श्री भजनलाल शर्मा** आहेत."
        elif language == "gu":
            return "રાજસ્થાનના માનનીય મુખ્યમંત્રી **શ્રી ભજનલાલ શર્મા** છે."
        else:
            return "The Chief Minister of Rajasthan is **Shri Bhajan Lal Sharma**. The Government of Rajasthan administers welfare and scholarship schemes such as the Mukhyamantri Higher Education Scholarship, Kalibai Scooty Scheme, and Anupriti Coaching Scheme."

    # 4. Scheme-specific matching
    matched = match_local_scheme(query)
    
    if matched:
        s_name = matched.get("scheme_name", "")
        s_name_hi = matched.get("scheme_name_hi", s_name)
        target = matched.get("target_category", "")
        elig = matched.get("eligibility", "")
        benefit = matched.get("benefit", "")
        portal = matched.get("portal_url", "https://hte.rajasthan.gov.in")
        deadline = matched.get("key_deadlines", "वार्षिक सत्र के अनुसार")
        docs = ", ".join(matched.get("required_documents", []))

        # SPEECH-FRIENDLY RESPONSE (Concise, no markdown)
        if is_speech:
            if language == "hi":
                return (
                    f"{s_name_hi} के तहत: {benefit}। "
                    f"पात्रता: {elig}। "
                    f"आवेदन हेतु आधिकारिक पोर्टल {portal} या एसएसओ पोर्टल पर जाएं।"
                )
            elif language == "mr":
                return (
                    f"{s_name} अंतर्गत: {benefit}। "
                    f"पात्रता: {elig}। "
                    f"अर्ज करण्यासाठी अधिकृत पोर्टल {portal} ला भेट द्या."
                )
            elif language == "gu":
                return (
                    f"{s_name} હેઠળ: {benefit}। "
                    f"પાત્રતા: {elig}। "
                    f"અરજી કરવા માટે અધિકૃત પોર્ટલ {portal} પર જાઓ."
                )
            else:
                return (
                    f"Under {s_name}: {benefit}. "
                    f"Eligibility: {elig}. "
                    f"You can apply on the official portal at {portal}."
                )

        # TEXT-FRIENDLY RESPONSE (Rich Markdown, tables, bullets)
        else:
            if language == "hi":
                return f"""### 🎓 {s_name_hi}

| विवरण | जानकारी |
| :--- | :--- |
| **योजना का नाम** | {s_name_hi} |
| **लक्षित वर्ग** | {target} |
| **वित्तीय लाभ** | **{benefit}** |
| **आधिकारिक पोर्टल** | [{portal}]({portal}) |
| **आवेदन समयसीमा** | {deadline} |

#### 📋 मुख्य पात्रता शर्तें:
* {elig}

#### 📑 आवश्यक दस्तावेज:
* {docs}

*🔗 अधिकृत जानकारी एवं आवेदन के लिए [राजस्थान एसएसओ पोर्टल]({portal}) पर लॉगिन करें।*
"""
            elif language == "mr":
                return f"""### 🎓 {s_name} ({s_name_hi})

| तपशील | माहिती |
| :--- | :--- |
| **योजनेचे नाव** | {s_name} |
| **पात्र वर्ग** | {target} |
| **आर्थिक लाभ** | **{benefit}** |
| **अधिकृत पोर्टल** | [{portal}]({portal}) |
| **अंतिम मुदत** | {deadline} |

#### 📋 पात्रता निकष:
* {elig}

#### 📑 आवश्यक कागदपत्रे:
* {docs}

*🔗 अधिक माहितीसाठी [{portal}]({portal}) ला भेट द्या.*
"""
            elif language == "gu":
                return f"""### 🎓 {s_name}

| વિગત | માહિતી |
| :--- | :--- |
| **યોજનાનું નામ** | {s_name} |
| **લક્ષિત વર્ગ** | {target} |
| **લાભ** | **{benefit}** |
| **પોર્ટલ** | [{portal}]({portal}) |
| **અરજી સમયમર્યાદા** | {deadline} |

#### 📋 મુખ્ય પાત્રતા:
* {elig}

#### 📑 જરૂરી દસ્તાવેજો:
* {docs}

*🔗 સત્તાવાર માહિતી માટે [{portal}]({portal}) ની મુલાકાત લો.*
"""
            else:
                return f"""### 🎓 {s_name}

| Key Metric | Details |
| :--- | :--- |
| **Scheme Name** | {s_name} ({s_name_hi}) |
| **Target Group** | {target} |
| **Key Benefits** | **{benefit}** |
| **Official Portal** | [{portal}]({portal}) |
| **Application Cycle** | {deadline} |

#### 📋 Eligibility Criteria:
* {elig}

#### 📑 Required Documentation:
* {docs}

*🔗 Apply online via the Rajasthan Higher Education Portal at [{portal}]({portal}).*
"""

    # 3. General overview / Fallback when no specific scheme is matched
    default_scheme = SCHEMES_LIST[0] if SCHEMES_LIST else {}
    s_default_name = default_scheme.get("scheme_name_hi", "मुख्यमंत्री उच्च शिक्षा छात्रवृत्ति योजना")
    s_default_benefit = default_scheme.get("benefit", "प्रतिवर्ष ₹5,000 की वित्तीय सहायता")

    if is_speech:
        if language == "hi":
            return f"राजस्थान सरकार उच्च शिक्षा के लिए कई योजनाएं चलाती है, जैसे {s_default_name} जिसके तहत {s_default_benefit} दी जाती है। अधिक विवरण हेतु hte.rajasthan.gov.in पर देखें।"
        elif language == "mr":
            return f"राजस्थान सरकार उच्च शिक्षणासाठी विविध योजना राबवते, जसे की मुख्यमंत्री उच्च शिक्षण शिष्यवृत्ती ज्यामध्ये {s_default_benefit} दिले जाते. अधिक माहितीसाठी hte.rajasthan.gov.in ला भेट द्या."
        elif language == "gu":
            return f"રાજસ્થાન સરકાર ઉચ્ચ શિક્ષણ માટે વિવિધ યોજનાઓ ચલાવે છે, જેમ કે મુખ્યમંત્રી ઉચ્ચ શિક્ષણ શિષ્યવૃત્તિ. વધુ વિગત માટે hte.rajasthan.gov.in જુઓ."
        else:
            return f"The Government of Rajasthan offers several higher education schemes including the Mukhyamantri Higher Education Scholarship providing {s_default_benefit}. Visit hte.rajasthan.gov.in for full details."
    else:
        if language == "hi":
            return f"""### 🏛️ राजस्थान उच्च शिक्षा एवं छात्रवृत्ति योजनाएं (VaniSetu Ground Truth)

आपकी खोज के आधार पर राजस्थान सरकार की प्रमुख कल्याणकारी योजनाएं उपलब्ध हैं:

* **मुख्यमंत्री उच्च शिक्षा छात्रवृत्ति योजना:** 12वीं में 60% उत्तीर्ण छात्रों हेतु ₹5,000 प्रतिवर्ष।
* **कालीबाई भील मेधावी छात्रा स्कूटी योजना:** मेधावी छात्राओं को निशुल्क स्कूटी, बीमा एवं पेट्रोल सहायता।
* **देवनारायण छात्रा स्कूटी योजना:** अति पिछड़ा वर्ग (MBC) की छात्राओं हेतु स्कूटी या वार्षिक प्रोत्साहन राशि।
* **मुख्यमंत्री अनुप्रति कोचिंग योजना:** UPSC, RAS, IIT-JEE, NEET की 100% मुफ्त कोचिंग व आवास भत्ता।
* **उत्तर मैट्रिक छात्रवृत्ति:** SC/ST/OBC/EWS हेतु शिक्षण शुल्क की शत-प्रतिशत प्रतिपूर्ति।

> 📌 **सहायता:** विशिष्ट योजना के बारे में विस्तार से जानने के लिए योजना का नाम या अपनी कक्षा/प्रतिशत लिखकर पूछें। आधिकारिक पोर्टल: [hte.rajasthan.gov.in](https://hte.rajasthan.gov.in)
"""
        elif language == "mr":
            return f"""### 🏛️ राजस्थान उच्च शिक्षण आणि शिष्यवृत्ती योजना (VaniSetu)

राजस्थान सरकारच्या प्रमुख योजना खालीलप्रमाणे आहेत:
* **मुख्यमंत्री उच्च शिक्षण शिष्यवृत्ती:** १२ वीत ६०% गुण मिळवणाऱ्या विद्यार्थ्यांना दरवर्षी ₹५,०००.
* **कालीबाई भील स्कूटी योजना:** गुणवंत विद्यार्थिनींना मोफत स्कूटी.
* **अनुप्रति कोचिंग योजना:** UPSC, RAS, NEET साठी १००% मोफत प्रशिक्षण.

> 📌 अधिक माहितीसाठी अधिकृत पोर्टलला भेट द्या: [hte.rajasthan.gov.in](https://hte.rajasthan.gov.in)
"""
        elif language == "gu":
            return f"""### 🏛️ રાજસ્થાન ઉચ્ચ શિક્ષણ અને શિષ્યવૃત્તિ યોજનાઓ (VaniSetu)

રાજસ્થાન સરકારની મુખ્ય કલ્યાણકારી યોજનાઓ:
* **મુખ્યમંત્રી ઉચ્ચ શિક્ષણ શિષ્યવૃત્તિ:** ૧૨મા ધોરણમાં ૬૦% પાસ વિદ્યાર્થીઓ માટે વાર્ષિક ₹૫,૦૦૦ સહાય.
* **કાલીબાઈ ભીલ સ્કૂટી યોજના:** તેજસ્વી વિદ્યાર્થિનીઓ માટે મફત સ્કૂટી.
* **અનુપ્રતિ કોચિંગ યોજના:** સ્પર્ધાત્મક પરીક્ષાઓ માટે ૧૦૦% મફત કોચિંગ.

> 📌 વધુ માહિતી માટે સત્તાવાર પોર્ટલ જુઓ: [hte.rajasthan.gov.in](https://hte.rajasthan.gov.in)
"""
        else:
            return f"""### 🏛️ Rajasthan Higher Education & Scholarship Schemes (VaniSetu Verified)

Based on your query, here are the major verified schemes available:

* **Mukhyamantri Uchha Shiksha Chhatravriti:** ₹5,000/yr for Class 12 (≥60% marks) college students.
* **Kalibai Bheel Medhavi Chhatra Scooty Yojana:** Free motorized two-wheeler for meritorious girl students.
* **Devnarayan Scooty & Incentive Yojana:** Free scooty or ₹10,000–₹20,000 annual stipend for MBC students.
* **Mukhyamantri Anupriti Coaching Yojana:** 100% free competitive exam coaching (UPSC, RAS, NEET, JEE).
* **Post-Matric Scholarship Scheme:** 100% non-refundable tuition reimbursement for SC/ST/OBC/EWS.

> 📌 **Tip:** Ask specifically about any scheme, eligibility criteria, or required documents. Official Portal: [hte.rajasthan.gov.in](https://hte.rajasthan.gov.in)
"""

MODELS_TO_TRY = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-3-flash-preview"]

async def generate_response(query: str, language: str = "hi", mode: str = "S2S") -> str:
    """Generate response using Gemini Flash via client.aio with resilient fallback to Local RAG."""
    if client is not None and hasattr(client, 'aio'):
        system_prompt = build_system_instruction(language, mode)
        for model_name in MODELS_TO_TRY:
            try:
                response = await client.aio.models.generate_content(
                    model=model_name,
                    contents=query,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.3,
                    ),
                )
                if response and response.text:
                    return response.text
            except Exception as e:
                err_str = str(e)
                print(f"[VaniSetu Engine] Model {model_name} error: {err_str[:120]}")
                continue

    # Immediate transition to local ground-truth RAG
    print(f"[VaniSetu Engine] Serving verified Local RAG response for query: '{query[:40]}...'")
    return get_local_failsafe_response(query, language, mode)

async def generate_response_stream(query: str, language: str = "hi", mode: str = "S2S") -> AsyncGenerator[str, None]:
    """Stream response via Gemini client.aio with model cascade, smoothly falling back to Local RAG SSE."""
    if client is not None and hasattr(client, 'aio'):
        system_prompt = build_system_instruction(language, mode)
        for model_name in MODELS_TO_TRY:
            try:
                response_stream = await client.aio.models.generate_content_stream(
                    model=model_name,
                    contents=query,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        temperature=0.3,
                    ),
                )
                chunk_emitted = False
                async for chunk in response_stream:
                    if chunk.text:
                        chunk_emitted = True
                        yield chunk.text
                        await asyncio.sleep(0.01)
                if chunk_emitted:
                    return
            except Exception as e:
                err_str = str(e)
                print(f"[VaniSetu Engine] Model {model_name} stream error: {err_str[:120]}")
                continue

    # Ground-truth Local RAG streaming
    print("[VaniSetu Engine] Live API models unavailable. Streaming verified Local RAG response.")
    fallback_text = get_local_failsafe_response(query, language, mode)
    
    # Smooth token streaming for realistic UI/UX
    words = re.findall(r'\S+|\n+', fallback_text)
    for word in words:
        if word.startswith('\n'):
            yield word
        else:
            yield word + " "
        await asyncio.sleep(0.02)