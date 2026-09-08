import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * Hardened Speech Recognition Hook for VaniSetu
 * Supports Chrome, Edge, Safari (WebKit), with permission state feedback
 * and audio wave visualization metrics.
 */
export const useSpeechRecognition = (language = 'hi-IN', onResult = () => {}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0); // 0.0 to 1.0 for waveform

  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  const capturedTextRef = useRef('');
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const mediaStreamRef = useRef(null);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  // Audio level analyzer using Web Audio API for true waveform visualization
  const startAudioMeter = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        simulateAudioMeter();
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        simulateAudioMeter();
        return;
      }

      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(1.0, avg / 80.0);
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (err) {
      console.warn('Microphone stream metering unavailable, using simulated pulse:', err);
      simulateAudioMeter();
    }
  };

  const simulateAudioMeter = () => {
    let tick = 0;
    const pulse = () => {
      tick += 0.2;
      const simulated = Math.abs(Math.sin(tick)) * 0.7 + 0.15;
      setAudioLevel(simulated);
      animFrameRef.current = requestAnimationFrame(pulse);
    };
    pulse();
  };

  const stopAudioMeter = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  };

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported in this browser.');
      setErrorStatus('unsupported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setErrorStatus(null);
      capturedTextRef.current = '';
      setTranscript('');
      startAudioMeter();
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
      console.warn('Speech recognition warning/error:', event.error);
      if (event.error === 'not-allowed') {
        setErrorStatus('permission-denied');
      } else if (event.error === 'no-speech') {
        setErrorStatus('no-speech');
      } else {
        setErrorStatus(event.error);
      }
      setIsListening(false);
      stopAudioMeter();
    };

    recognition.onend = () => {
      setIsListening(false);
      stopAudioMeter();
      // Auto-submit the captured text when user finishes speaking
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
      stopAudioMeter();
    };
  }, [language]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setErrorStatus('unsupported');
        return;
      }
    }

    try {
      setErrorStatus(null);
      setTranscript('');
      capturedTextRef.current = '';
      recognitionRef.current.start();
    } catch (err) {
      console.warn('Mic toggle reset:', err);
      try {
        recognitionRef.current.stop();
        setTimeout(() => {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error('Failed to restart recognition:', e);
          }
        }, 200);
      } catch (e) {
        console.error('Mic stop/restart error:', e);
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn('Mic stop notice:', err);
      }
      setIsListening(false);
      stopAudioMeter();
    }
  }, []);

  return { 
    isListening, 
    transcript, 
    errorStatus, 
    audioLevel, 
    startListening, 
    stopListening 
  };
};