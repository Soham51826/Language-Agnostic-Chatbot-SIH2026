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
  const [isStreaming, setIsStreaming] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  const activeLangConfig = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];

  // SSE Streaming Handler with Progressive Audio Narration
  const handleSendMessageStream = async (queryText) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isStreaming) return;

    stopSpeech();
    setInputQuery('');
    setIsStreaming(true);

    // Append user turn and initialize empty model bubble
    setMessages(prev => [
      ...prev,
      { role: 'user', text: textToSend },
      { role: 'assistant', text: '' }
    ]);

    let accumulatedText = '';

    try {
      const response = await fetch('http://localhost:8000/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          language: activeLangConfig.apiCode,
          session_id: 'unified_web_session'
        })
      });

      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop(); // Keep partial chunks in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.replace('data: ', '').trim();

            if (dataStr === '[DONE]') {
              if (ttsEnabled && accumulatedText) {
                speakText(accumulatedText, selectedLang);
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
              }
            } catch (err) {
              console.error('SSE JSON parse error:', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Streaming request failed:', err);
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: 'assistant',
          text: '⚠️ सर्वर से कनेक्ट करने में त्रुटि। कृपया सुनिश्चित करें कि FastAPI बैकएंड चल रहा है।'
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const { isListening, startListening, stopListening } = useSpeechRecognition(
    selectedLang,
    (spokenTranscript) => {
      setInputQuery(spokenTranscript);
      handleSendMessageStream(spokenTranscript);
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
              <div className="message-content">
                {m.text || (isStreaming && idx === messages.length - 1 ? (
                  <span className="cursor-blink">▍</span>
                ) : '')}
              </div>
              {m.role === 'assistant' && m.text && (
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
        {isStreaming && (
          <div className="streaming-indicator">
            <span>Generating response...</span>
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
          onKeyDown={(e) => e.key === 'Enter' && handleSendMessageStream()}
        />

        <button 
          className="send-btn" 
          onClick={() => handleSendMessageStream()}
          disabled={isStreaming || !inputQuery.trim()}
        >
          {isStreaming ? 'Streaming...' : 'Send'}
        </button>
      </footer>
    </div>
  );
}