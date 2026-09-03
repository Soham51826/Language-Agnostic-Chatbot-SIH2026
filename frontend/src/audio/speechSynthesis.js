let voices = [];
let activeUtterance = null;

const loadVoices = () => {
  if ('speechSynthesis' in window) {
    voices = window.speechSynthesis.getVoices();
  }
};

loadVoices();
if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

const getBestVoice = (langCode) => {
  if (!voices.length) loadVoices();
  const shortCode = langCode.split('-')[0];

  const premiumMatch = voices.find(
    v => v.lang === langCode && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('India'))
  );
  if (premiumMatch) return premiumMatch;

  const exactMatch = voices.find(v => v.lang === langCode || v.lang.replace('_', '-') === langCode);
  if (exactMatch) return exactMatch;

  const baseMatch = voices.find(v => v.lang.startsWith(shortCode));
  if (baseMatch) return baseMatch;

  if (shortCode === 'gu') {
    const hindiFallback = voices.find(v => v.lang.startsWith('hi') || v.name.includes('Hindi'));
    if (hindiFallback) return hindiFallback;
  }

  return voices.find(v => v.lang === 'en-IN') || voices[0] || null;
};

// Immediate hard stop function
export const stopSpeech = () => {
  if (!('speechSynthesis' in window)) return;

  try {
    // 1. Unbind active callbacks to prevent delayed triggers
    if (activeUtterance) {
      activeUtterance.onend = null;
      activeUtterance.onerror = null;
      activeUtterance = null;
    }

    // 2. Clear paused lock and cancel speech queue
    window.speechSynthesis.pause();
    window.speechSynthesis.cancel();
    
    // 3. Chromium engine unfreeze hack
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (err) {
    console.error('Failed to stop speech:', err);
  }
};

export const speakText = (text, lang = 'hi-IN') => {
  if (!('speechSynthesis' in window)) return;

  // Stop any ongoing voice completely before starting
  stopSpeech();

  const cleanText = text.replace(/[*#_`~>]/g, '').trim();
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = lang;
  utterance.rate = 0.92;
  utterance.pitch = 1.0;

  const matchedVoice = getBestVoice(lang);
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  utterance.onend = () => {
    activeUtterance = null;
  };

  utterance.onerror = (e) => {
    console.warn('Utterance stopped or errored:', e);
    activeUtterance = null;
  };

  activeUtterance = utterance;

  // Unpause if stuck and speak
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }
  
  window.speechSynthesis.speak(utterance);
};