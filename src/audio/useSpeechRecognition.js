import { useEffect, useRef, useState } from "react";
import { SPEECH_LANGUAGES } from "./speechConfig";

export function useSpeechRecognition() {
    const recognitionRef = useRef(null);

    const [transcript, setTranscript] = useState("");
    const [finalTranscript, setFinalTranscript] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState(null);

    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    useEffect(() => {
        if (!SpeechRecognition) {
            setError("Speech recognition is not supported in this browser.");
        }
    }, [SpeechRecognition]);

    const startListening = (lang = "en") => {
        if (!SpeechRecognition) {
            return;
        }

        setError(null);
        setTranscript("");
        setFinalTranscript("");

        const recognition = new SpeechRecognition();

        recognition.lang =
            SPEECH_LANGUAGES[lang] || SPEECH_LANGUAGES.en;

        recognition.continuous = false;
        recognition.interimResults = true;

        recognitionRef.current = recognition;

        recognition.onresult = (event) => {
            let currentTranscript = "";
            let confirmedTranscript = "";

            for (let i = 0; i < event.results.length; i++) {
                const result = event.results[i];
                const text = result[0].transcript;

                currentTranscript += text;

                if (result.isFinal) {
                    confirmedTranscript += text;
                }
            }

            setTranscript(currentTranscript);

            if (confirmedTranscript) {
                setFinalTranscript(confirmedTranscript);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.onerror = (event) => {
            setError(`Speech recognition error: ${event.error}`);
            setIsListening(false);
            recognitionRef.current = null;
        };

        recognition.start();
        setIsListening(true);
    };

    const stopListening = () => {
        if (!recognitionRef.current) {
            return;
        }

        recognitionRef.current.stop();
    };

    return {
        transcript,
        finalTranscript,
        isListening,
        error,
        startListening,
        stopListening,
    };
}