import React, { useState, useRef, useEffect } from 'react';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './audio/speechConfig';
import { useSpeechRecognition } from './audio/useSpeechRecognition';
import { speakText, stopSpeech } from './audio/speechSynthesis';
import './App.css';

export default function App() {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'नमस्ते! मैं वाणीसेतु हूँ। राजस्थान छात्रवृत्ति एवं प्रवेश योजनाओं के बारे में पूछें।' }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState(DEFAULT_LANGUAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const activeLangConfig = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];

  const handleSendMessage = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isLoading) return;

    setMessages(prev => [...prev, { role: 'user', text: textToSend }]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          language: activeLangConfig.apiCode,
          session_id: 'unified_web_session'
        })
      });

      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();

      setMessages(prev => [...prev, { role: 'assistant', text: data.response_text }]);

      if (ttsEnabled) {
        speakText(data.response_text, selectedLang);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev, 
        { role: 'assistant', text: '⚠️ सर्वर से कनेक्ट करने में असमर्थ। कृपया सुनिश्चित करें कि FastAPI बैकएंड चल रहा है।' }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const { isListening, startListening, stopListening } = useSpeechRecognition(
    selectedLang,
    (spokenTranscript) => {
      setInputQuery(spokenTranscript);
      handleSendMessage(spokenTranscript);
    }
  );

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div className="header-brand">
          <h2>वाणीसेतु (VaniSetu)</h2>
          <span className="badge">SIH 2026</span>
        </div>
        <div className="header-controls">
          <select 
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
            className={`toggle-btn ${ttsEnabled ? 'active' : ''}`}
            onClick={() => {
              if (ttsEnabled) stopSpeech();
              setTtsEnabled(!ttsEnabled);
            }}
            title="Toggle Voice Responses"
          >
            {ttsEnabled ? '🔊 Sound On' : '🔇 Mute'}
          </button>
        </div>
      </header>

      <main className="messages-area">
        {messages.map((m, idx) => (
          <div key={idx} className={`message-row ${m.role}`}>
            <div className="message-bubble">
              <div className="message-content">{m.text}</div>
              {m.role === 'assistant' && (
                <button 
                  className="replay-speech-btn"
                  onClick={() => speakText(m.text, selectedLang)}
                  title="Speak again"
                >
                  🗣️
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message-row assistant">
            <div className="message-bubble loading">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="input-area">
        <button 
          className={`mic-btn ${isListening ? 'listening' : ''}`}
          onClick={isListening ? stopListening : startListening}
          title={isListening ? 'Listening... click to stop' : 'Click to speak'}
        >
          {isListening ? '🛑' : '🎙️'}
        </button>

        <input 
          type="text" 
          placeholder={isListening ? "Listening to your voice..." : "योजना या छात्रवृत्ति के बारे में पूछें..."}
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
        />

        <button 
          className="send-btn" 
          onClick={() => handleSendMessage()}
          disabled={isLoading || !inputQuery.trim()}
        >
          Send
        </button>
      </footer>
    </div>
  );
}