import { useState, useRef, useEffect, useCallback } from 'react';

export const useSpeechRecognition = (language = 'hi-IN', onResult = () => {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  const capturedTextRef = useRef('');

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      capturedTextRef.current = '';
      setTranscript('');
    };

    recognition.onresult = (event) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }
      capturedTextRef.current = fullTranscript;
      setTranscript(fullTranscript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-submit the captured text when user stops speaking
      const finalText = capturedTextRef.current.trim();
      if (finalText && onResultRef.current) {
        onResultRef.current(finalText);
        capturedTextRef.current = '';
      }
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (e) {
        // cleanup ignore
      }
    };
  }, [language]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      setTranscript('');
      capturedTextRef.current = '';
      recognitionRef.current.start();
    } catch (err) {
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          recognitionRef.current.start();
        }, 150);
      } catch (e) {
        console.error('Mic toggle error:', e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('Mic stop error:', err);
      }
      setIsListening(false);
    }
  }, []);

  return { isListening, transcript, startListening, stopListening };
};