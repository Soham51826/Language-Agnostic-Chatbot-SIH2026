import { useState } from "react";
import { useSpeechRecognition } from "./audio/useSpeechRecognition";
import {
  speakText,
  stopSpeaking,
} from "./audio/speechSynthesis";

function App() {
  const [sourceLanguage, setSourceLanguage] = useState("en");
  const [targetLanguage, setTargetLanguage] = useState("hi");
  const [textToSpeak, setTextToSpeak] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsError, setTtsError] = useState(null);

  const {
    transcript,
    isListening,
    error,
    startListening,
    stopListening,
  } = useSpeechRecognition();

  return (
    <div>
      <h1>VaniSetu Audio</h1>

      <p>Speech & Audio Integration</p>

      <label>
        🎤 Speak in:{" "}
        <select
          value={sourceLanguage}
          onChange={(event) =>
            setSourceLanguage(event.target.value)
          }
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="mr">Marathi</option>
          <option value="gu">Gujarati</option>
        </select>
      </label>

      <br />
      <br />

      <label>
        🔊 Bot replies in:{" "}
        <select
          value={targetLanguage}
          onChange={(event) =>
            setTargetLanguage(event.target.value)
          }
        >
          <option value="en">English</option>
          <option value="hi">Hindi</option>
          <option value="mr">Marathi</option>
          <option value="gu">Gujarati</option>
        </select>
      </label>

      <br />
      <br />

      <h2>Speech to Text</h2>

      <textarea
        value={transcript}
        readOnly
        placeholder="Transcription will appear here..."
        rows="5"
        cols="50"
      />

      <br />
      <br />

      {!isListening ? (
        <button onClick={() => startListening(sourceLanguage)}>
          🎤 Start Listening
        </button>
      ) : (
        <button onClick={stopListening}>
          ⏹ Stop Listening
        </button>
      )}

      {error && <p>{error}</p>}

      <h2>Text to Speech</h2>

      <p>
        The bot's response will be spoken in the selected
        "Bot replies in" language.
      </p>

      <textarea
        value={textToSpeak}
        onChange={(event) => setTextToSpeak(event.target.value)}
        placeholder="Type something to speak..."
        rows="5"
        cols="50"
      />

      <br />
      <br />

      <button
        onClick={async () => {
          setTtsError(null);

          const result = await speakText(
            textToSpeak,
            targetLanguage,
            {
              onStart: () => {
                setIsSpeaking(true);
              },

              onEnd: () => {
                setIsSpeaking(false);
              },

              onError: () => {
                setIsSpeaking(false);
                setTtsError("speech-error");
              },

              onUnavailable: () => {
                setIsSpeaking(false);
                setTtsError("voice-unavailable");
              },
            }
          );

          if (!result.success) {
            setIsSpeaking(false);

            if (result.reason === "empty-text") {
              setTtsError("empty-text");
            }
          }
        }}
      >
        🔊 Speak
      </button>

      <button
        onClick={() => {
          stopSpeaking();
          setIsSpeaking(false);
        }}
      >
        ⏹ Stop
      </button>

      {isSpeaking && <p>🔊 Speaking...</p>}

      {ttsError === "voice-unavailable" && (
        <p>
          ⚠️ No speech voice is available for this language.
        </p>
      )}

      {ttsError === "empty-text" && (
        <p>⚠️ Please enter some text first.</p>
      )}

      {ttsError === "speech-error" && (
        <p>
          ⚠️ Speech synthesis encountered an error.
        </p>
      )}
    </div>
  );
}

export default App;