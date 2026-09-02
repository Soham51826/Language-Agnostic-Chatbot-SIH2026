export const speakText = (text, lang = 'hi-IN') => {
  if (!('speechSynthesis' in window)) {
    console.warn('Speech synthesis is not supported in this browser.');
    return;
  }

  window.speechSynthesis.cancel();

  // Strip markdown formatting symbols so pronunciation remains natural
  const cleanText = text.replace(/[*#_`]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = lang;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
};

export const stopSpeech = () => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
};