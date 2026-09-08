/**
 * VaniSetu Hardened Speech Synthesis Engine
 * Cross-browser voice detection (Chrome, Edge, Firefox, Safari)
 * Automatic sentence-chunking to prevent Chrome 15s freeze
 * Race condition prevention and keep-alive heartbeat
 */

let cachedVoices = [];
let currentPlaybackSession = 0;
let sentenceQueue = [];
let isQueueActive = false;
let keepAliveTimer = null;
let playbackStateChangeListeners = new Set();

const notifyStateChange = (isPlaying) => {
  playbackStateChangeListeners.forEach(listener => {
    try {
      listener(isPlaying);
    } catch (e) {
      console.warn('Error in playback listener:', e);
    }
  });
};

export const subscribePlaybackState = (callback) => {
  playbackStateChangeListeners.add(callback);
  return () => playbackStateChangeListeners.delete(callback);
};

// Cross-browser voice initialization with polling fallback for Safari/Firefox
const loadVoices = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const available = window.speechSynthesis.getVoices();
  if (available && available.length > 0) {
    cachedVoices = available;
  }
};

loadVoices();
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }
  // Polling fallback: some browsers don't fire onvoiceschanged
  [150, 400, 800, 1500].forEach(delay => {
    setTimeout(loadVoices, delay);
  });
}

/**
 * Find best voice matching target language, regional variants, and quality
 */
export const getBestVoice = (langCode) => {
  if (!cachedVoices.length) loadVoices();
  const shortCode = langCode.split('-')[0].toLowerCase();

  // 1. Natural / Neural / High-fidelity voice matching exact locale
  const premiumMatch = cachedVoices.find(v => 
    (v.lang === langCode || v.lang.replace('_', '-') === langCode) && 
    (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Neural') || v.name.includes('India'))
  );
  if (premiumMatch) return premiumMatch;

  // 2. Exact locale match
  const exactMatch = cachedVoices.find(v => v.lang === langCode || v.lang.replace('_', '-') === langCode);
  if (exactMatch) return exactMatch;

  // 3. Short language code prefix match
  const baseMatch = cachedVoices.find(v => v.lang.toLowerCase().startsWith(shortCode));
  if (baseMatch) return baseMatch;

  // 4. Regional phonetic fallbacks (Gujarati / Marathi -> Hindi voice if native TTS absent)
  if (shortCode === 'gu' || shortCode === 'mr') {
    const hindiVoice = cachedVoices.find(v => 
      v.lang.toLowerCase().startsWith('hi') || v.name.toLowerCase().includes('hindi')
    );
    if (hindiVoice) return hindiVoice;
  }

  // 5. English India or primary system default
  return cachedVoices.find(v => v.lang === 'en-IN') || cachedVoices[0] || null;
};

/**
 * Immediate, hard stop of all audio and queues
 */
export const stopSpeech = () => {
  currentPlaybackSession++;
  sentenceQueue = [];
  isQueueActive = false;

  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.pause();
      window.speechSynthesis.cancel();
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {
      console.warn('stopSpeech error:', e);
    }
  }

  notifyStateChange(false);
};

/**
 * Split text into semantic sentences respecting English and Indic punctuation (। ॥ . ! ?)
 */
const splitIntoSentences = (text) => {
  // Strip markdown, asterisks, brackets, hashes, URLs
  let cleaned = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // link to text
    .replace(/https?:\/\/\S+/g, '')          // urls
    .replace(/[*#_`~>|\\]/g, ' ')            // markdown markers
    .replace(/\s+/g, ' ')
    .trim();

  // Split on full stops, Hindi Purna Viram (।), double viram (॥), exclamation, question marks, newlines
  const rawSegments = cleaned.split(/(?<=[.!?।॥\n])\s+/);
  const result = [];

  for (const seg of rawSegments) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    // If segment is very long (> 160 chars), break on commas or pauses to prevent truncation
    if (trimmed.length > 160) {
      const subParts = trimmed.split(/,\s+/);
      result.push(...subParts.map(s => s.trim()).filter(Boolean));
    } else {
      result.push(trimmed);
    }
  }

  return result.length > 0 ? result : [cleaned];
};

/**
 * Start queue processor for sentence-by-sentence TTS
 */
const processQueue = (sessionId, lang) => {
  if (sessionId !== currentPlaybackSession) return;
  if (!sentenceQueue.length) {
    isQueueActive = false;
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
    notifyStateChange(false);
    return;
  }

  isQueueActive = true;
  notifyStateChange(true);

  const sentence = sentenceQueue.shift();
  if (!sentence) {
    processQueue(sessionId, lang);
    return;
  }

  const utterance = new SpeechSynthesisUtterance(sentence);
  utterance.lang = lang;
  utterance.rate = 0.95;
  utterance.pitch = 1.0;

  const matchedVoice = getBestVoice(lang);
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onend = () => {
    if (sessionId === currentPlaybackSession) {
      processQueue(sessionId, lang);
    }
  };

  utterance.onerror = (e) => {
    console.warn('Sentence synthesis notice:', e.error);
    if (sessionId === currentPlaybackSession) {
      processQueue(sessionId, lang);
    }
  };

  // Chromium engine keep-alive: pause and resume every 10s to bypass 15s freeze bug
  if (!keepAliveTimer) {
    keepAliveTimer = setInterval(() => {
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.error('Error in window.speechSynthesis.speak:', err);
    if (sessionId === currentPlaybackSession) {
      processQueue(sessionId, lang);
    }
  }
};

/**
 * Speak text with automatic sentence-chunking and cross-browser resilience
 */
export const speakText = (text, lang = 'hi-IN') => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this environment.');
    return;
  }

  // Hard stop prior utterances
  stopSpeech();

  if (!text || !text.trim()) return;

  const sentences = splitIntoSentences(text);
  if (!sentences.length) return;

  const sessionId = ++currentPlaybackSession;
  sentenceQueue = sentences;

  processQueue(sessionId, lang);
};