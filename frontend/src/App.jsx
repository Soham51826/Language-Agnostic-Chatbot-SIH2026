import React, { useState, useRef, useEffect } from 'react';
import { speakText, stopAudio } from './audio/speechSynthesis';
import { useSpeechRecognition } from './audio/useSpeechRecognition';
import './App.css';

const LANGUAGES = [
  { label: 'Hindi', code: 'hi-IN', apiCode: 'hi' },
  { label: 'English', code: 'en-IN', apiCode: 'en' },
  { label: 'Rajasthani', code: 'hi-IN', apiCode: 'raj' },
  { label: 'Marathi', code: 'mr-IN', apiCode: 'mr' },
  { label: 'Gujarati', code: 'gu-IN', apiCode: 'gu' }
];

const MODES = [
  { id: 'text-text', label: '📝 Text → Text', input: 'text', output: 'text' },
  { id: 'speech-speech', label: '🎙️ Speech → Speech', input: 'voice', output: 'voice' },
  { id: 'text-speech', label: '⌨️ Text → Speech', input: 'text', output: 'voice' },
  { id: 'speech-text', label: '🗣️ Speech → Text', input: 'voice', output: 'text' }
];

export default function App() {
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'नमस्ते! मैं वाणीसेतु हूँ। राजस्थान छात्रवृत्ति एवं प्रवेश योजनाओं के बारे में पूछें।'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('hi-IN');
  const [activeMode, setActiveMode] = useState('text-speech');
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  const currentLangObj = LANGUAGES.find((l) => l.code === selectedLanguage) || LANGUAGES[0];
  const currentModeObj = MODES.find((m) => m.id === activeMode) || MODES[0];

  const { isListening, startListening, stopListening } = useSpeechRecognition({
    language: selectedLanguage,
    onResult: (transcript) => {
      setInputText(transcript);
      handleSendMessageStream(transcript);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessageStream = async (queryText) => {
    const textToSend = queryText || inputText;
    if (!textToSend.trim() || isLoading) return;

    // Append User Message
    const userMessage = { sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // Append Initial Blank Bot Message
    setMessages((prev) => [...prev, { sender: 'bot', text: '' }]);

    const API_BASE_URL =
      import.meta.env.VITE_BACKEND_URL ||
      'https://vanisetu-backend-language-agnostic.onrender.com';

    try {
      console.log(
        `[VaniSetu] Sending: "${textToSend}" in lang: ${currentLangObj.apiCode}, mode: ${currentModeObj.id}`
      );

      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: textToSend,
          language: currentLangObj.apiCode,
          mode: currentModeObj.id
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP Error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let accumulatedText = '';

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
              console.log('[VaniSetu] Stream completed.');
              if (currentModeObj.output === 'voice' && accumulatedText) {
                speakText(accumulatedText, selectedLanguage);
              }
              break;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.text) {
                accumulatedText += parsed.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = { ...updated[lastIdx], text: accumulatedText };
                  return updated;
                });
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (err) {
              // Direct string chunk fallback
              accumulatedText += dataStr;
              setMessages((prev) => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                updated[lastIdx] = { ...updated[lastIdx], text: accumulatedText };
                return updated;
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[VaniSetu] Connection failed:', err);
      setMessages((prev) => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          sender: 'bot',
          text: '⚠️ सर्वर से कनेक्ट करने में असमर्थ। कृपया जांचें कि बैकएंड टर्मिनल (FastAPI) चल रहा है या नहीं।'
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="title-area">
          <h1>वाणीसेतु (VaniSetu)</h1>
          <span className="badge">SIH 2026</span>
        </div>

        <div className="controls-area">
          <select
            value={selectedLanguage}
            onChange={(e) => setSelectedLanguage(e.target.value)}
            className="lang-select"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code + lang.apiCode} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>

          <button onClick={stopAudio} className="stop-audio-btn" title="Stop Audio">
            ⏹ Stop Audio
          </button>
        </div>
      </header>

      {/* Modes Navigation */}
      <div className="mode-bar">
        <span className="mode-label">MODE:</span>
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={`mode-btn ${activeMode === mode.id ? 'active' : ''}`}
            onClick={() => setActiveMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="active-status">
        <span className="dot">●</span> Active: {currentModeObj.label}
      </div>

      {/* Chat Area */}
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.sender}`}>
            <div className="message-bubble">
              {msg.text}
              {msg.sender === 'bot' && msg.text && (
                <button
                  className="replay-btn"
                  onClick={() => speakText(msg.text, selectedLanguage)}
                  title="Play Voice"
                >
                  🗣️
                </button>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message-row bot">
            <div className="message-bubble typing-indicator">...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Console */}
      <div className="input-bar">
        {currentModeObj.input === 'voice' ? (
          <button
            className={`mic-btn ${isListening ? 'listening' : ''}`}
            onClick={isListening ? stopListening : startListening}
          >
            {isListening ? '🔴 Recording...' : '🎙️ Click to Speak'}
          </button>
        ) : (
          <input
            type="text"
            className="text-input"
            placeholder="योजना या छात्रवृत्ति के बारे में पूछें..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessageStream()}
            disabled={isLoading}
          />
        )}

        <button
          className="send-btn"
          onClick={() => handleSendMessageStream()}
          disabled={isLoading || (!inputText.trim() && currentModeObj.input === 'text')}
        >
          Send
        </button>
      </div>
    </div>
  );
}