let voices = [];

// Populate browser voices cache
const loadVoices = () => {
  if ('speechSynthesis' in window) {
    voices = window.speechSynthesis.getVoices();
  }
};

loadVoices();
if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

// Find best matching voice for Indic languages (prioritizing Google/Microsoft native packs)
const getBestVoice = (langCode) => {
  if (!voices.length) loadVoices();
  const shortCode = langCode.split('-')[0];

  return (
    voices.find(v => v.lang === langCode && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('India'))) ||
    voices.find(v => v.lang.startsWith(shortCode)) ||
    null
  );
};

export const speakText = (text, lang = 'hi-IN') => {
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();

  // Strip Markdown markers so synthesizer doesn't pronounce asterisks
  const cleanText = text.replace(/[*#_`]/g, '').trim();
  if (!cleanText) return;

  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = lang;
  utterance.rate = 0.95; // Natural cadence for clarity
  utterance.pitch = 1.0;

  const matchedVoice = getBestVoice(lang);
  if (matchedVoice) {
    utterance.voice = matchedVoice;
  }

  window.speechSynthesis.speak(utterance);
};

export const stopSpeech = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};