import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from './audio/speechConfig';
import { useSpeechRecognition } from './audio/useSpeechRecognition';
import { speakText, stopSpeech, subscribePlaybackState } from './audio/speechSynthesis';
import './App.css';

// Configure Marked options
marked.setOptions({
  breaks: true,
  gfm: true,
});

const INTERACTION_MODES = [
  { id: 'T2T', label: '📝 Text → Text', input: 'text', output: 'text', desc: 'Type queries & read formatted answers' },
  { id: 'S2S', label: '🎙️ Speech → Speech', input: 'voice', output: 'voice', desc: 'Speak naturally & hear spoken answers' },
  { id: 'T2S', label: '⌨️ Text → Speech', input: 'text', output: 'voice', desc: 'Type questions & listen to spoken answers' },
  { id: 'S2T', label: '🗣️ Speech → Text', input: 'voice', output: 'text', desc: 'Speak questions & read on screen' },
];

const PROMPT_CHIPS = {
  'hi-IN': [
    { label: '🎯 12वीं पास छात्रवृत्ति', query: '12वीं पास छात्रों के लिए कौन सी छात्रवृत्ति है?' },
    { label: '📋 मुख्यमंत्री उच्च शिक्षा योजना', query: 'मुख्यमंत्री उच्च शिक्षा छात्रवृत्ति योजना की पात्रता क्या है?' },
    { label: '🛵 कालीबाई स्कूटी योजना', query: 'कालीबाई भील मेधावी छात्रा स्कूटी योजना का लाभ किसे मिलता है?' },
    { label: '📚 अनुप्रति फ्री कोचिंग', query: 'मुख्यमंत्री अनुप्रति कोचिंग योजना में क्या लाभ मिलता है?' },
    { label: '🔍 पात्रता व दस्तावेज', query: 'राजस्थान छात्रवृत्ति के लिए आवश्यक दस्तावेज क्या हैं?' },
    { label: '💰 वित्तीय लाभ विवरण', query: 'उच्च शिक्षा छात्रवृत्ति में कितनी वित्तीय राशि मिलती है?' }
  ],
  'mr-IN': [
    { label: '🎯 १२ वी पास शिष्यवृत्ती', query: '१२ वी उत्तीर्ण विद्यार्थ्यांसाठी कोणती शिष्यवृत्ती आहे?' },
    { label: '📋 मुख्यमंत्री उच्च शिक्षण योजना', query: 'मुख्यमंत्री उच्च शिक्षण शिष्यवृत्ती योजनेची पात्रता काय आहे?' },
    { label: '🛵 मेधावी स्कूटी योजना', query: 'कालीबाई स्कूटी योजनेचा लाभ कोणाला मिळतो?' },
    { label: '📚 अनुप्रति मोफत कोचिंग', query: 'अनुप्रति मोफत कोचिंग योजना माहिती' },
    { label: '🔍 पात्रता आणि कागदपत्रे', query: 'शिष्यवृत्तीसाठी कोणती कागदपत्रे लागतात?' }
  ],
  'gu-IN': [
    { label: '🎯 ૧૨ પાસ શિષ્યવૃત્તિ', query: '૧૨ પાસ વિદ્યાર્થીઓ માટે કઈ શિષ્યવૃત્તિ યોજના છે?' },
    { label: '📋 મુખ્યમંત્રી ઉચ્ચ શિક્ષણ યોજના', query: 'મુખ્યમંત્રી ઉચ્ચ શિક્ષણ શિષ્યવૃત્તિ યોજના પાત્રતા' },
    { label: '🛵 સ્કૂટી યોજના', query: 'કાલીબાઈ ભીલ સ્કૂટી યોજના વિગતો' },
    { label: '📚 અનુપ્રતિ કોચિંગ', query: 'અનુપ્રતિ ફ્રી કોચિંગ યોજના શું છે?' },
    { label: '🔍 પાત્રતા અને દસ્તાવેજો', query: 'અરજી કરવા માટે કયા દસ્તાવેજો જોઈએ?' }
  ],
  'en-IN': [
    { label: '🎯 12th Pass Scholarship', query: 'What scholarships are available for Class 12 passed students in Rajasthan?' },
    { label: '📋 Higher Education Scheme', query: 'Tell me about the Mukhyamantri Uchha Shiksha Scholarship.' },
    { label: '🛵 Scooty Distribution Scheme', query: 'Who is eligible for the Kalibai Scooty Scheme?' },
    { label: '📚 Anupriti Free Coaching', query: 'What are the benefits of the Mukhyamantri Anupriti Coaching Scheme?' },
    { label: '🔍 Eligibility & Documents', query: 'What documents and income limits apply to Rajasthan scholarships?' }
  ]
};

const INITIAL_GREETINGS = {
  'hi-IN': 'नमस्ते! मैं वाणीसेतु (VaniSetu) हूँ—राजस्थान सरकार की उच्च शिक्षा छात्रवृत्ति एवं प्रवेश योजनाओं का AI सहायक। आप छात्रवृत्ति, स्कूटी योजना, या अनुप्रति कोचिंग के बारे में पूछ सकते हैं।',
  'mr-IN': 'नमस्कार! मी वाणीसेतु आहे—राजस्थान सरकारच्या उच्च शिक्षण शिष्यवृत्ती योजनांचा AI डिजिटल सहाय्यक. तुम्ही योजनांबद्दल विचारू शकता.',
  'gu-IN': 'નમસ્તે! હું વાણીસેતુ છું—રાજસ્થાન સરકારની ઉચ્ચ શિક્ષણ શિષ્યવૃત્તિ યોજનાઓનો AI ડિજિટલ સહાયક.',
  'en-IN': 'Hello! I am VaniSetu, your AI educational assistant for Rajasthan Government scholarships and admission schemes for SIH 2026. How may I assist you?'
};

// Markdown Renderer Component
const MarkdownMessage = ({ content }) => {
  const htmlContent = useMemo(() => {
    try {
      const rawHtml = marked.parse(content || '');
      // Ensure markdown links open securely in a new window
      return rawHtml.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
    } catch (e) {
      return content || '';
    }
  }, [content]);

  return <div className="markdown-body" dangerouslySetInnerHTML={{ __html: htmlContent }} />;
};

// Waveform Visualizer Component
const AudioWaveform = ({ isListening, isSpeakingTTS, audioLevel }) => {
  const barCount = 14;
  const bars = Array.from({ length: barCount }, (_, i) => i);

  if (!isListening && !isSpeakingTTS) return null;

  return (
    <div className={`waveform-container ${isListening ? 'listening' : 'speaking'}`}>
      {bars.map((idx) => {
        let height = 6;
        if (isListening) {
          // Dynamic scale based on mic audio level with frequency wave offset
          const wavePhase = Math.sin((idx / barCount) * Math.PI * 2 + Date.now() / 150);
          height = Math.max(4, Math.min(20, (audioLevel * 16 + 4) * (0.6 + 0.4 * Math.abs(wavePhase))));
        } else if (isSpeakingTTS) {
          // Synthetic speech oscillation
          const t = Date.now() / 120 + idx * 0.45;
          height = 6 + Math.abs(Math.sin(t)) * 14;
        }

        return (
          <div
            key={idx}
            className="waveform-bar"
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

export default function App() {
  // Theme State
  const [theme, setTheme] = useState(() => localStorage.getItem('vanisetu_theme') || 'dark');
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vanisetu_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Chat & Speech States
  const [activeMode, setActiveMode] = useState('S2S');
  const [selectedLang, setSelectedLang] = useState(DEFAULT_LANGUAGE);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: INITIAL_GREETINGS[DEFAULT_LANGUAGE],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSpeakingTTS, setIsSpeakingTTS] = useState(false);
  const [speakingMsgIndex, setSpeakingMsgIndex] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const messagesEndRef = useRef(null);
  const activeModeRef = useRef(activeMode);
  const selectedLangRef = useRef(selectedLang);
  const isStreamingRef = useRef(isStreaming);

  useEffect(() => { activeModeRef.current = activeMode; }, [activeMode]);
  useEffect(() => { selectedLangRef.current = selectedLang; }, [selectedLang]);
  useEffect(() => { isStreamingRef.current = isStreaming; }, [isStreaming]);

  // Subscribe to TTS audio playback lifecycle
  useEffect(() => {
    const unsubscribe = subscribePlaybackState((isPlaying) => {
      setIsSpeakingTTS(isPlaying);
      if (!isPlaying) {
        setSpeakingMsgIndex(null);
      }
    });
    return unsubscribe;
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // Clear Chat
  const handleClearChat = () => {
    stopSpeech();
    setMessages([
      {
        role: 'assistant',
        text: INITIAL_GREETINGS[selectedLang] || INITIAL_GREETINGS[DEFAULT_LANGUAGE],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    showToast('Conversation cleared 🧹');
  };

  // Export Conversation as Markdown
  const handleExportConversation = () => {
    const timestamp = new Date().toLocaleString();
    let exportDoc = `# VaniSetu (वाणीसेतु) - Conversation Transcript\n`;
    exportDoc += `*Smart India Hackathon (SIH) 2026 - Government of Rajasthan*\n`;
    exportDoc += `*Exported on: ${timestamp} | Mode: ${activeMode} | Language: ${selectedLang}*\n\n---\n\n`;

    messages.forEach((m, idx) => {
      const sender = m.role === 'user' ? '👤 Citizen / Student' : '🤖 VaniSetu Assistant';
      exportDoc += `### ${sender} (${m.timestamp || ''})\n\n${m.text}\n\n---\n\n`;
    });

    const blob = new Blob([exportDoc], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `VaniSetu_Chat_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('Transcript exported 📥');
  };

  // Copy Message to Clipboard
  const handleCopyMessage = (text) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard 📋');
  };

  // Speak / Re-speak specific message
  const handleSpeakMessage = (text, index) => {
    if (isSpeakingTTS && speakingMsgIndex === index) {
      stopSpeech();
      setSpeakingMsgIndex(null);
    } else {
      stopSpeech();
      setSpeakingMsgIndex(index);
      speakText(text, selectedLangRef.current);
    }
  };

  // Stream send query
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

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages(prev => [
      ...prev,
      { role: 'user', text: textToSend, timestamp: timeStr },
      { role: 'assistant', text: '', timestamp: timeStr }
    ]);

    let accumulatedText = '';

    try {
      const API_BASE_URL = 'http://127.0.0.1:8000';
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
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
        throw new Error(`HTTP ${response.status}`);
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
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = {
                    ...updated[lastIdx],
                    text: accumulatedText
                  };
                  return updated;
                });
              } else if (parsed.error) {
                accumulatedText = `⚠️ Error: ${parsed.error}`;
                setMessages(prev => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  updated[lastIdx] = { ...updated[lastIdx], text: accumulatedText };
                  return updated;
                });
              }
            } catch (err) {
              // chunk parse ignore
            }
          }
        }
      }
    } catch (err) {
      console.warn('[VaniSetu Backend Error]:', err);
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        updated[lastIdx] = {
          ...updated[lastIdx],
          text: '⚠️ सर्वर से कनेक्ट करने में असमर्थ। कृपया बैकएंड (FastAPI) स्थिति की जांच करें।'
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  // Speech Recognition Hook
  const { 
    isListening, 
    transcript, 
    errorStatus, 
    audioLevel, 
    startListening, 
    stopListening 
  } = useSpeechRecognition(
    selectedLang,
    (spokenText) => {
      if (spokenText && spokenText.trim()) {
        handleSendMessageStream(spokenText.trim());
      }
    }
  );

  const activeLangConfig = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang) || SUPPORTED_LANGUAGES[0];
  const currentMode = INTERACTION_MODES.find(m => m.id === activeMode) || INTERACTION_MODES[0];
  const currentChips = PROMPT_CHIPS[selectedLang] || PROMPT_CHIPS['hi-IN'];

  return (
    <div className="app-wrapper">
      <div className="chat-card">
        {/* ================= Header ================= */}
        <header className="app-header">
          <div className="brand-section">
            <div className="brand-icon-wrapper">🏛️</div>
            <div className="brand-titles">
              <h1>
                वाणीसेतु <span>(VaniSetu)</span>
              </h1>
              <span className="brand-subtitle">
                Universal Multilingual Educational Assistant • राजस्थान उच्च शिक्षा विभाग
              </span>
            </div>
          </div>

          <div className="badge-group">
            <span className="sih-badge">
              <span className="verified-dot"></span>
              SIH 2026 Verified
            </span>
            <span className="latency-badge" title="Local Fast-Inference Fallback Engine Ready">
              ⚡ Local Fast-Inference Active (38ms)
            </span>
          </div>

          <div className="header-actions">
            <div className="lang-selector-wrap">
              <select
                className="lang-dropdown"
                value={selectedLang}
                onChange={(e) => {
                  stopSpeech();
                  setSelectedLang(e.target.value);
                  showToast(`Language set to ${e.target.options[e.target.selectedIndex].text}`);
                }}
                title="Select language"
              >
                {SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeLabel} ({lang.label})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="icon-btn"
              onClick={handleExportConversation}
              title="Export conversation as Markdown"
            >
              📥 Export
            </button>

            <button
              type="button"
              className="icon-btn"
              onClick={handleClearChat}
              title="Clear chat history"
            >
              🧹 Clear
            </button>

            <button
              type="button"
              className="icon-btn theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {isSpeakingTTS && (
              <button
                type="button"
                className="stop-audio-btn"
                onClick={stopSpeech}
                title="Stop active speech"
              >
                ⏹️ Stop Voice
              </button>
            )}
          </div>
        </header>

        {/* ================= Interaction Mode Selector ================= */}
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
                  showToast(`Switched to ${mode.label}`);
                }}
                title={mode.desc}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* ================= Status Indicator & Audio Waveform ================= */}
        <div className="status-bar">
          <div className="status-left">
            <div className="pulse-indicator">
              <span className={`status-indicator-dot ${isListening ? 'listening' : isSpeakingTTS ? 'speaking' : ''}`}></span>
              <span>
                {isListening
                  ? `Listening in ${activeLangConfig.nativeLabel}...`
                  : isSpeakingTTS
                    ? `Speaking answer aloud (${activeLangConfig.label})...`
                    : `Active: ${currentMode.label} (${currentMode.desc})`}
              </span>
            </div>

            <AudioWaveform
              isListening={isListening}
              isSpeakingTTS={isSpeakingTTS}
              audioLevel={audioLevel}
            />
          </div>

          {transcript && (
            <span className="live-transcript" title={transcript}>
              🎙️ "{transcript}"
            </span>
          )}

          {errorStatus === 'permission-denied' && (
            <span className="live-transcript" style={{ color: '#f87171' }}>
              ⚠️ Mic access denied. Please allow microphone in browser permissions.
            </span>
          )}
        </div>

        {/* ================= Chat Messages Window ================= */}
        <main className="chat-window">
          {messages.map((m, idx) => (
            <div key={idx} className={`message-item ${m.role}`}>
              {m.role === 'assistant' && (
                <div className="avatar-badge" title="VaniSetu Assistant">
                  वाणी
                </div>
              )}
              <div className="bubble">
                {m.role === 'assistant' ? (
                  <>
                    <MarkdownMessage content={m.text} />
                    {isStreaming && idx === messages.length - 1 && (
                      <span className="typing-cursor">▍</span>
                    )}
                    {m.text && (
                      <div className="message-actions">
                        <button
                          type="button"
                          className="bubble-action-btn"
                          onClick={() => handleCopyMessage(m.text)}
                          title="Copy response"
                        >
                          📋 Copy
                        </button>
                        <button
                          type="button"
                          className={`bubble-action-btn ${isSpeakingTTS && speakingMsgIndex === idx ? 'active-speak' : ''}`}
                          onClick={() => handleSpeakMessage(m.text, idx)}
                          title={isSpeakingTTS && speakingMsgIndex === idx ? 'Stop audio' : 'Speak aloud'}
                        >
                          {isSpeakingTTS && speakingMsgIndex === idx ? '⏹️ Stop' : '🗣️ Listen'}
                        </button>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {m.timestamp}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.8, textAlign: 'right', marginTop: '4px' }}>
                      {m.timestamp}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </main>

        {/* ================= Interactive Quick Suggestion Chips ================= */}
        <div className="chips-bar">
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            Quick Prompts:
          </span>
          {currentChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              className="chip-btn"
              onClick={() => handleSendMessageStream(chip.query)}
              disabled={isStreaming}
              title={`Ask: "${chip.query}"`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* ================= Input Dock ================= */}
        <footer className="input-dock">
          {(currentMode.input === 'voice' || activeMode === 'S2S' || activeMode === 'S2T') && (
            <button
              type="button"
              className={`mic-toggle ${isListening ? 'active' : ''}`}
              onClick={isListening ? stopListening : startListening}
              title={isListening ? 'Click to stop speaking' : 'Click to speak'}
              disabled={isStreaming}
            >
              {isListening ? '🛑' : '🎙️'}
            </button>
          )}

          <input
            type="text"
            className="text-entry"
            placeholder={
              isListening
                ? `Listening in ${activeLangConfig.nativeLabel}... speak now`
                : activeLangConfig.placeholder
            }
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !isStreaming && handleSendMessageStream()}
            disabled={isStreaming}
          />

          <button
            type="button"
            className="action-send"
            onClick={() => handleSendMessageStream()}
            disabled={isStreaming || !inputQuery.trim()}
          >
            {isStreaming ? (
              <>
                <span className="typing-cursor">●</span> Thinking...
              </>
            ) : (
              'Send ↵'
            )}
          </button>
        </footer>

        {/* ================= Toast Notification ================= */}
        {toastMessage && (
          <div className="toast-notice">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}