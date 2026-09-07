/**
 * voice.js — Browser speech recognition (STT) and speech synthesis (TTS).
 *
 * Both are feature-detected. If unsupported, or if microphone permission is
 * denied, callers get a clear unavailable/error callback instead of a crash.
 * Text input is always the fallback path — voice is additive, never required.
 */

const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

export const voice = {
  sttSupported: !!SpeechRecognitionImpl,
  ttsSupported: 'speechSynthesis' in window,

  /**
   * @param {object} handlers - { onResult(text), onStart(), onEnd(), onError(message) }
   * @returns {{ stop: () => void } | null}
   */
  listen({ onResult, onStart, onEnd, onError }) {
    if (!this.sttSupported) {
      onError && onError('Speech recognition is not supported in this browser.');
      return null;
    }

    const recognition = new SpeechRecognitionImpl();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => onStart && onStart();
    recognition.onend = () => onEnd && onEnd();
    recognition.onresult = (event) => {
      const transcript = event.results[0] && event.results[0][0] ? event.results[0][0].transcript : '';
      onResult && onResult(transcript);
    };
    recognition.onerror = (event) => {
      const messages = {
        'not-allowed': 'Microphone permission was denied.',
        'no-speech': 'No speech was detected.',
        'audio-capture': 'No microphone was found.',
        network: 'A network error interrupted speech recognition.',
      };
      onError && onError(messages[event.error] || `Speech recognition error: ${event.error}`);
    };

    try {
      recognition.start();
    } catch (err) {
      onError && onError('Could not start speech recognition.');
      return null;
    }

    return { stop: () => recognition.stop() };
  },

  /**
   * @param {string} text
   * @param {object} opts - { onEnd(), onError(message) }
   */
  speak(text, opts = {}) {
    if (!this.ttsSupported || !text) {
      opts.onError && opts.onError('Speech synthesis is not supported in this browser.');
      return;
    }
    try {
      window.speechSynthesis.cancel(); // avoid overlapping utterances
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => opts.onEnd && opts.onEnd();
      utterance.onerror = () => opts.onError && opts.onError('Speech synthesis failed.');
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      opts.onError && opts.onError('Speech synthesis failed.');
    }
  },

  stopSpeaking() {
    if (this.ttsSupported) window.speechSynthesis.cancel();
  },
};
