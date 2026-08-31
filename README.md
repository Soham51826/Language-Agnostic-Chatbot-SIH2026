# VaniSetu (वाणीसेतु) 🎙️🎓
### *Universal Multilingual Voice & Text Educational Assistant*

[![SIH 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://www.sih.gov.in/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Google Gemini](https://img.shields.io/badge/AI-Gemini%202.5%20Flash-4285F4.svg?logo=google&logoColor=white)](https://ai.google.dev/)
[![Web Speech API](https://img.shields.io/badge/Voice-Web%20Speech%20API-blueviolet.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-blue.svg?logo=python&logoColor=white)](https://www.python.org/)

---

## 📌 Executive Summary

**VaniSetu** is an intelligent, low-latency, conversational assistance platform engineered to eliminate linguistic and literacy barriers across public education portals in India. 

Designed for **Smart India Hackathon (SIH) 2026**, VaniSetu operates as an interactive, voice- and text-enabled floating layer over educational databases. It enables students, parents, and rural citizens to query welfare initiatives, scholarship requirements, admission processes, and institutional guidelines using spoken or typed regional languages—including vernacular dialects and romanized colloquial forms (such as *Hinglish*, *Marathlish*, and *Gujlish*). 

The platform relies on a **strictly grounded Retrieval-Augmented Generation (RAG)** pipeline backed by **Google Gemini**, ensuring verified factual responses with near-zero generative hallucinations while narrating answers via localized **Text-to-Speech (TTS)**.

---

## 🏆 Hackathon & Metadata Overview

* **Hackathon:** Smart India Hackathon (SIH) 2026
* **Problem Statement ID:** `SIH25104`
* **Problem Statement Title:** Language Agnostic Chatbot
* **Nodal Ministry / Organization:** Government of Rajasthan
* **Theme:** Smart Education
* **Category:** Software
* **Team Name:** AlgoRhythmics
* **Target Dialects & Locales:**
  * **Hindi** (`hi-IN` / Devanagari)
  * **Marathi** (`mr-IN` / Devanagari)
  * **Gujarati** (`gu-IN` / Gujarati Script)
  * **English** (`en-IN` / Latin)
  * **Transliterated Vernaculars** (*Hinglish*, *Marathlish*, *Gujlish*)

---

## 🧩 The Problem Space

Official central and state government portals (such as Rajasthan's Higher Technical Education portal or Shala Darpan) maintain complex, dense, and predominantly English- or formal Hindi-based documentation. 

### Key Pain Points:
1. **Linguistic Exclusivity:** Millions of rural students and first-generation learners cannot parse bureaucratic English circulars or formal state directives.
2. **Text & Digital Illiteracy:** Parents and students unfamiliar with complex UI navigation struggle to locate relevant schemes, leading to missed scholarship and admission deadlines.
3. **High Administrative Burden:** State departments and helpdesks face enormous inquiry volumes for standard, repetitive questions (e.g., eligibility, required paperwork, dates).
4. **LLM Hallucination Risks:** Public generic LLMs often invent non-existent schemes, dead web links, or incorrect criteria when responding to legal or academic questions.

---

## 💡 The Solution Architecture

VaniSetu addresses these challenges via a 4-tier decoupled pipeline: