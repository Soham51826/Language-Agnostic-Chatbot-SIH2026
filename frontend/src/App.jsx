import React, { useState, useRef, useEffect } from 'react';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './audio/speechConfig';
import { useSpeechRecognition } from './audio/useSpeechRecognition';
import { speakText, stopSpeech } from './audio/speechSynthesis';
import './App.css';

const INTERACTION_MODES = [
  { id: 'T2T', label: '📝 Text → Text', input: 'text', output: 'text' },
  { id: 'S2S', label: '🎙️ Speech → Speech', input: 'voice', output: 'voice' },
  { id: 'T2S', label: '⌨️ Text → Speech', input: 'text', output: 'voice' },
  { id: 'S2T', label: '🗣️ Speech → Text', input: 'voice', output: 'text' },
];

export default function App() {
  const [activeMode, setActiveMode] = useState('S2S');
  const [selectedLang, setSelectedLang] = useState(DEFAULT_LANGUAGE);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'नमस्ते! मैं वाणीसेतु हूँ। राजस्थान छात्रवृत्ति एवं प्रवेश योजनाओं के बारे में पूछें।' }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);

  // Synchronous refs to prevent stale closure bugs in async callbacks
  const activeModeRef = useRef(activeMode);
  const selectedLangRef = useRef(selectedLang);
  const isStreamingRef = useRef(isStreaming);

  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
  useEffect(() => { selectedLangRef.current = selectedLang; }, [selectedLang]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Core stream handler
  const handleSendMessageStream = async (queryText) => {
    const textToSend = (queryText !== undefined && queryText !== null ? queryText : inputQuery).trim();
    if (!textToSend || isStreamingRef.current) return;

    const currentLangCode = selectedLangRef.current;
    const currentModeId = activeModeRef.current;
    const currentModeObj = INTERACTION_MODES.find(m => m.id === currentModeId) || INTERACTION_MODES[0];
    const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLangCode) || SUPPORTED_LANGUAGES[0];

    stopSpeech();
    setInputQuery('');
    setIsStreaming(true);

    setMessages(prev => [
      ...prev,
      { role: 'user', text: textToSend },
      { role: 'assistant', text: '' }
    ]);

    let accumulatedText = '';

    try {
      console.log(`[VaniSetu] Sending: "${textToSend}" in lang: ${currentLangObj.apiCode}, mode: ${currentModeId}`);
      
      const response = await fetch('http://localhost:8000/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          language: currentLangObj.apiCode,
          session_id: 'vanisetu_session',
          mode: currentModeId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();

            if (dataStr === '[DONE]') {
              console.log('[VaniSetu] Stream finished.');
              if (currentModeObj.output === 'voice' && accumulatedText) {
                speakText(accumulatedText, currentLangCode);
              }
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.delta) {
                accumulatedText += parsed.delta;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    role: 'assistant',
                    text: accumulatedText
                  };
                  return updated;
                });
              } else if (parsed.error) {
                console.error('[VaniSetu Backend Error]:', parsed.error);
                accumulatedText = `⚠️ Error: ${parsed.error}`;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', text: accumulatedText };
                  return updated;
                });
              }
            } catch (err) {
              console.warn('Parsing line failed:', line);
            }
          }
        }
      }
    } catch (err) {
      console.error('[VaniSetu Request Failed]:', err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          text: '⚠️ सर्वर से कनेक्ट करने में असमर्थ। कृपया जांचें कि बैकएंड टर्मिनल (FastAPI) चल रहा है या नहीं।'
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const { isListening, transcript, startListening, stopListening } = useSpeechRecognition(
    selectedLang,
    (spokenText) => {
      console.log('[Speech Recognition Finished]:', spokenText);
      if (spokenText && spokenText.trim()) {
        handleSendMessageStream(spokenText.trim());
      }
    }
  );

  const activeLangConfig = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];
  const currentMode = INTERACTION_MODES.find(m => m.id === activeMode) || INTERACTION_MODES[0];

  return (
    <div className="app-wrapper">
      <div className="chat-card">
        {/* Header */}
        <header className="app-header">
          <div className="brand-section">
            <h1>वाणीसेतु (VaniSetu)</h1>
            <span className="sih-badge">SIH 2026</span>
          </div>
          <div className="header-actions">
            <select 
              className="lang-dropdown"
              value={selectedLang} 
              onChange={(e) => {
                stopSpeech();
                setSelectedLang(e.target.value);
              }}
            >
              {SUPPORTED_LANGUAGES.map(lang => (
                <option key={lang.code} value={lang.code}>{lang.label}</option>
              ))}
            </select>
            <button 
              type="button" 
              className="stop-audio-btn" 
              onClick={stopSpeech}
            >
              ⏹️ Stop Audio
            </button>
          </div>
        </header>

        {/* 4 Interaction Modes */}
        <div className="mode-bar">
          <span className="mode-tag">MODE:</span>
          <div className="mode-buttons">
            {INTERACTION_MODES.map((mode) => (
              <button
                key={mode.id}
                className={`mode-btn ${activeMode === mode.id ? 'active' : ''}`}
                onClick={() => {
                  stopSpeech();
                  setActiveMode(mode.id);
                }}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Status Strip */}
        <div className="status-bar">
          <div className="status-indicator">
            <span className={`pulse-circle ${isListening ? 'listening' : ''}`}></span>
            <span>
              {isListening ? `Listening in ${activeLangConfig.label}...` : `Active: ${currentMode.label}`}
            </span>
          </div>
          {transcript && <span className="live-transcript">"{transcript}"</span>}
        </div>

        {/* Message Window */}
        <main className="chat-window">
          {messages.map((m, idx) => (
            <div key={idx} className={`message-item ${m.role}`}>
              <div className="bubble">
                <div className="text-content">
                  {m.text || (isStreaming && idx === messages.length - 1 ? (
                    <span className="typing-cursor">▍</span>
                  ) : '')}
                </div>
                {m.role === 'assistant' && m.text && (
                  <button 
                    type="button"
                    className="listen-btn"
                    onClick={() => speakText(m.text, selectedLang)}
                    title="Speak aloud"
                  >
                    🗣️
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        {/* Input Footer */}
        <footer className="input-dock">
          {(currentMode.input === 'voice' || activeMode === 'S2S' || activeMode === 'S2T') && (
            <button 
              type="button"
              className={`mic-toggle ${isListening ? 'active' : ''}`}
              onClick={isListening ? stopListening : startListening}
              title={isListening ? 'Stop recording' : 'Start speaking'}
            >
              {isListening ? '🛑' : '🎙️'}
            </button>
          )}

          <input 
            type="text" 
            className="text-entry"
            placeholder={
              isListening 
                ? "Listening... speak now" 
                : currentMode.input === 'voice' 
                  ? "Click microphone to speak (or type here)..." 
                  : "योजना या छात्रवृत्ति के बारे में पूछें..."
            }
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessageStream()}
          />

          <button 
            type="button"
            className="action-send" 
            onClick={() => handleSendMessageStream()}
            disabled={isStreaming || !inputQuery.trim()}
          >
            {isStreaming ? '...' : 'Send'}
          </button>
        </footer>
      </div>
    </div>
  );
}