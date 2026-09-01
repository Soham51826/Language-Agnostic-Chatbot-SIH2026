import { SPEECH_LANGUAGES } from "./speechConfig";

let activeUtterance = null;
let speechRequestId = 0;

export function getAvailableVoices() {
    return window.speechSynthesis.getVoices();
}

export function getVoiceForLanguage(lang) {
    const languageCode =
        SPEECH_LANGUAGES[lang] || SPEECH_LANGUAGES.en;

    const voices = getAvailableVoices();

    const exactVoice = voices.find(
        (voice) => voice.lang === languageCode
    );

    if (exactVoice) {
        return exactVoice;
    }

    const baseLanguage = languageCode.split("-")[0];

    const languageVoice = voices.find(
        (voice) => voice.lang.startsWith(`${baseLanguage}-`)
    );

    return languageVoice || null;
}

function waitForVoices() {
    return new Promise((resolve) => {
        const voices = getAvailableVoices();

        if (voices.length > 0) {
            resolve(voices);
            return;
        }

        const handleVoicesChanged = () => {
            window.speechSynthesis.removeEventListener(
                "voiceschanged",
                handleVoicesChanged
            );

            resolve(getAvailableVoices());
        };

        window.speechSynthesis.addEventListener(
            "voiceschanged",
            handleVoicesChanged
        );

        setTimeout(() => {
            window.speechSynthesis.removeEventListener(
                "voiceschanged",
                handleVoicesChanged
            );

            resolve(getAvailableVoices());
        }, 1000);
    });
}

export async function speakText(text, lang = "en", callbacks = {}) {
    if (!text || !text.trim()) {
        return {
            success: false,
            reason: "empty-text",
        };
    }

    const requestId = ++speechRequestId;

    const languageCode =
        SPEECH_LANGUAGES[lang] || SPEECH_LANGUAGES.en;

    await waitForVoices();

    if (requestId !== speechRequestId) {
        return {
            success: false,
            reason: "cancelled",
        };
    }

    const voice = getVoiceForLanguage(lang);

    if (!voice) {
        console.warn(
            `No speech synthesis voice available for ${languageCode}.`
        );

        if (callbacks.onUnavailable) {
            callbacks.onUnavailable();
        }

        return {
            success: false,
            reason: "voice-unavailable",
        };
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    activeUtterance = utterance;

    utterance.lang = languageCode;
    utterance.voice = voice;

    utterance.onstart = () => {
        if (activeUtterance !== utterance) {
            return;
        }

        if (callbacks.onStart) {
            callbacks.onStart();
        }
    };

    utterance.onend = () => {
        if (activeUtterance !== utterance) {
            return;
        }

        activeUtterance = null;

        if (callbacks.onEnd) {
            callbacks.onEnd();
        }
    };

    utterance.onerror = (event) => {
        if (activeUtterance !== utterance) {
            return;
        }

        activeUtterance = null;

        if (
            event.error === "canceled" ||
            event.error === "interrupted"
        ) {
            return;
        }

        if (callbacks.onError) {
            callbacks.onError(event);
        }
    };

    window.speechSynthesis.speak(utterance);

    return {
        success: true,
    };
}

export function stopSpeaking() {
    speechRequestId++;

    activeUtterance = null;

    window.speechSynthesis.cancel();
}