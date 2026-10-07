/**
 * Production Voice Service for GramCare AI
 * Handles Multilingual Speech-to-Text (STT) and Text-to-Speech (TTS)
 * across Desktop, Mobile browsers, and mobile app runtimes with zero demo data.
 */

export interface SpeechRecognitionOptions {
  languageCode: string;
  onInterimResult?: (transcript: string) => void;
  onFinalResult: (transcript: string) => void;
  onError: (errorKey: string, errorMessage: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
}

export const SPEECH_LANG_LOCALE_MAP: Record<string, string> = {
  en: 'en-IN',
  te: 'te-IN',
  hi: 'hi-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ml: 'ml-IN'
};

export const VOICE_ERROR_MESSAGES: Record<string, Record<string, string>> = {
  en: {
    not_supported: 'Voice recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or use text input.',
    permission_denied: 'Microphone permission was denied. Please enable microphone access in your browser settings to speak.',
    no_speech: 'No speech was detected. Please try speaking again into your microphone.',
    network_error: 'Network connection issue during speech recognition. Please check your internet connection.',
    audio_capture: 'No microphone found on your device. Please connect a microphone or use text input.',
    generic_error: 'Voice recognition encountered an issue. Please try again or type your query.',
    tts_not_supported: 'Text-to-speech voice output is not supported on this device/browser.'
  },
  te: {
    not_supported: 'ఈ బ్రౌజర్‌లో వాయిస్ గుర్తింపు అందుబాటులో లేదు. దయచేసి Chrome/Edge లేదా టైపింగ్ ఉపయోగించండి.',
    permission_denied: 'మైక్రోఫోన్ అనుమతి నిరాకరించబడింది. మాట్లాడటానికి బ్రౌజర్ సెట్టింగ్స్‌లో మైక్రోఫోన్ అనుమతి ఇవ్వండి.',
    no_speech: 'స్వర ధ్వని ఏదీ వినిపించలేదు. దయచేసి మైక్రోఫోన్ దగ్గర మళ్ళీ మాట్లాడండి.',
    network_error: 'వాయిస్ గుర్తింపు సమయంలో నెట్‌వర్క్ సమస్య ఏర్పడింది. ఇంటర్నెట్ సరిచూసుకొని మళ్ళీ ప్రయత్నించండి.',
    audio_capture: 'మీ పరికరంలో మైక్రోఫోన్ కనుగొనబడలేదు. దయచేసి టైపింగ్ ఉపయోగించండి.',
    generic_error: 'వాయిస్ గుర్తింపులో సమస్య ఏర్పడింది. దయచేసి మళ్ళీ మాట్లాడండి లేదా టైప్ చేయండి.',
    tts_not_supported: 'ఈ పరికరంలో వాయిస్ అవుట్‌పుట్ అందుబాటులో లేదు.'
  },
  hi: {
    not_supported: 'इस ब्राउज़र में वॉयस इनपुट समर्थित नहीं है। कृपया Chrome/Edge ब्राउज़र या टेक्स्ट इनपुट का उपयोग करें।',
    permission_denied: 'माइक्रोफ़ोन अनुमति अस्वीकार कर दी गई। बोलने के लिए ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति दें।',
    no_speech: 'कोई आवाज़ सुनाई नहीं दी। कृपया माइक्रोफ़ोन में फिर से बोलें।',
    network_error: 'आवाज़ पहचान के दौरान नेटवर्क समस्या आई। कृपया इंटरनेट जांचें और पुनः प्रयास करें।',
    audio_capture: 'आपके उपकरण में कोई माइक्रोफ़ोन नहीं मिला। कृपया टेक्स्ट इनपुट का उपयोग करें।',
    generic_error: 'आवाज़ पहचानने में समस्या आई। कृपया पुनः प्रयास करें या टाइप करें।',
    tts_not_supported: 'इस उपकरण में वॉयस आउटपुट समर्थित नहीं है।'
  },
  ta: {
    not_supported: 'இந்த உலாவியில் குரல் அறிதல் ஆதரிக்கப்படவில்லை. Chrome/Edge அல்லது உரையை பயன்படுத்தவும்.',
    permission_denied: 'மைக்ரோஃபோன் அனுமதி மறுக்கப்பட்டது. உலாவி அமைப்புகளில் அனுமதியை இயக்கவும்.',
    no_speech: 'குரல் எதுவும் கேட்கவில்லை. மைக்ரோஃபோனில் மீண்டும் பேசவும்.',
    network_error: 'குரல் அறிதலின் போது பிணைய சிக்கல் ஏற்பட்டது. இணையத்தை சரிபார்க்கவும்.',
    audio_capture: 'உங்கள் சாதனத்தில் மைக்ரோஃபோன் இல்லை. உரை உள்ளீட்டைப் பயன்படுத்தவும்.',
    generic_error: 'குரல் அறிதலில் சிக்கல் ஏற்பட்டது. மீண்டும் முயற்சிக்கவும் அல்லது தட்டச்சு செய்யவும்.',
    tts_not_supported: 'இந்த சாதனத்தில் குரல் வெளியீடு ஆதரிக்கப்படவில்லை.'
  },
  kn: {
    not_supported: 'ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಬೆಂಬಲಿತವಾಗಿಲ್ಲ. Chrome/Edge ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.',
    permission_denied: 'ಮೈಕ್ರೊಫೋನ್ ಅನುಮತಿಯನ್ನು ನಿರಾಕರಿಸಲಾಗಿದೆ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳಲ್ಲಿ ಅನುಮತಿ ನೀಡಿ.',
    no_speech: 'ಯಾವುದೇ ಧ್ವನಿ ಕೇಳಿಸಲಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೈಕ್ರೊಫೋನ್‌ನಲ್ಲಿ ಪುನಃ ಮಾತನಾಡಿ.',
    network_error: 'ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆಯಲ್ಲಿ ನೆಟ್‌ವರ್ಕ್ ದೋಷ ಕಂಡುಬಂದಿದೆ. ಇಂಟರ್ನೆಟ್ ಪರಿಶೀಲಿಸಿ.',
    audio_capture: 'ನಿಮ್ಮ ಸಾಧನದಲ್ಲಿ ಮೈಕ್ರೊಫೋನ್ ಕಂಡುಬಂದಿಲ್ಲ. ಪಠ್ಯ ಇನ್‌ಪುಟ್ ಬಳಸಿ.',
    generic_error: 'ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆಯಲ್ಲಿ ದೋಷ ಸಂಭವಿಸಿದೆ. ದಯವಿಟ್ಟು ಪುನಃ ಪ್ರಯತ್ನಿಸಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.',
    tts_not_supported: 'ಈ ಸಾಧನದಲ್ಲಿ ಧ್ವನಿ ಔಟ್‌ಪುಟ್ ಲಭ್ಯವಿಲ್ಲ.'
  },
  ml: {
    not_supported: 'ഈ ബ്രൗസറിൽ ശബ്ദ തിരിച്ചറിയൽ ലഭ്യമല്ല. Chrome/Edge അല്ലെങ്കിൽ ടെക്സ്റ്റ് ഉപയോഗിക്കുക.',
    permission_denied: 'മൈക്രോഫോൺ അനുമതി നിരസിച്ചു. ബ്രൗസർ ക്രമീകരണങ്ങളിൽ അനുമതി നൽകുക.',
    no_speech: 'ശബ്ദം ഒന്നും കേട്ടില്ല. ദയവായി മൈക്രോഫോണിൽ വീണ്ടും സംസാരിക്കുക.',
    network_error: 'ശബ്ദ തിരിച്ചറിയലിൽ നെറ്റ്‌വർക്ക് തകരാർ ഉണ്ടായി. ഇൻ്റർനെറ്റ് പരിശോധിക്കുക.',
    audio_capture: 'നിങ്ങളുടെ ഉപകരണത്തിൽ മൈക്രോഫോൺ കണ്ടെത്തിയില്ല. ടെക്സ്റ്റ് ഉപയോഗിക്കുക.',
    generic_error: 'ശബ്ദ തിരിച്ചറിയലിൽ പിശക് സംഭവിച്ചു. വീണ്ടും ശ്രമിക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക.',
    tts_not_supported: 'ഈ ഉപകരണത്തിൽ വോയ്സ് ഔട്ട്പുട്ട് ലഭ്യമല്ല.'
  }
};

export function getVoiceErrorMessage(key: string, languageCode: string): string {
  const lang = languageCode in VOICE_ERROR_MESSAGES ? languageCode : 'en';
  const dict = VOICE_ERROR_MESSAGES[lang] || VOICE_ERROR_MESSAGES.en;
  return dict[key] || dict.generic_error;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

export function isSpeechSynthesisSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

// Module-level tracker to prevent multiple simultaneous recognition sessions
let activeRecognitionSession: { stop: () => void; abort: () => void } | null = null;

/**
 * Creates and starts a SpeechRecognition instance with proper callbacks and locale configuration.
 * Enforces a single active session and cleanly detaches handlers on completion or abort.
 */
export function startSpeechRecognition(options: SpeechRecognitionOptions): { stop: () => void; abort: () => void } | null {
  if (!isSpeechRecognitionSupported()) {
    options.onError('not_supported', getVoiceErrorMessage('not_supported', options.languageCode));
    return null;
  }

  // Prevent multiple simultaneous recognition sessions
  if (activeRecognitionSession) {
    try {
      activeRecognitionSession.abort();
    } catch {
      // ignore
    }
    activeRecognitionSession = null;
  }

  try {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();

    const targetLocale = SPEECH_LANG_LOCALE_MAP[options.languageCode] || 'en-IN';
    recognition.lang = targetLocale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let hasReceivedResult = false;
    let latestTranscript = '';
    let isExplicitlyStopped = false;
    let isExplicitlyAborted = false;
    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (activeRecognitionSession === sessionHandle) {
        activeRecognitionSession = null;
      }
      try {
        recognition.onstart = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
      } catch {
        // ignore
      }
    };

    recognition.onstart = () => {
      if (isCleanedUp) return;
      if (options.onStart) options.onStart();
    };

    recognition.onresult = (event: any) => {
      if (isCleanedUp) return;
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptPart = event.results[i]?.[0]?.transcript || '';
        if (event.results[i]?.isFinal) {
          final += transcriptPart;
        } else {
          interim += transcriptPart;
        }
      }

      if (interim) {
        latestTranscript = interim;
        if (options.onInterimResult) {
          options.onInterimResult(interim);
        }
      }

      if (final) {
        hasReceivedResult = true;
        latestTranscript = final;
        options.onFinalResult(final.trim());
      }
    };

    recognition.onerror = (event: any) => {
      if (isCleanedUp) return;
      const err = event.error;

      if (err === 'not-allowed' || err === 'permission-denied') {
        options.onError('permission_denied', getVoiceErrorMessage('permission_denied', options.languageCode));
      } else if (err === 'no-speech') {
        if (!hasReceivedResult && !isExplicitlyStopped && !isExplicitlyAborted) {
          // If interim speech was previously received before timeout, deliver it
          if (latestTranscript.trim()) {
            hasReceivedResult = true;
            options.onFinalResult(latestTranscript.trim());
          } else {
            options.onError('no_speech', getVoiceErrorMessage('no_speech', options.languageCode));
          }
        }
      } else if (err === 'audio-capture') {
        options.onError('audio_capture', getVoiceErrorMessage('audio_capture', options.languageCode));
      } else if (err === 'network') {
        options.onError('network_error', getVoiceErrorMessage('network_error', options.languageCode));
      } else if (err !== 'aborted') {
        if (!isExplicitlyAborted) {
          options.onError('generic_error', getVoiceErrorMessage('generic_error', options.languageCode));
        }
      }
    };

    recognition.onend = () => {
      if (isCleanedUp) return;
      // If recognition ended without isFinal event, but speech was captured in interim, deliver it
      if (!hasReceivedResult && !isExplicitlyAborted && latestTranscript.trim()) {
        hasReceivedResult = true;
        options.onFinalResult(latestTranscript.trim());
      }
      cleanup();
      if (options.onEnd) {
        options.onEnd();
      }
    };

    const sessionHandle = {
      stop: () => {
        if (isCleanedUp) return;
        isExplicitlyStopped = true;
        // Deliver captured speech immediately upon stop if available
        if (!hasReceivedResult && latestTranscript.trim()) {
          hasReceivedResult = true;
          options.onFinalResult(latestTranscript.trim());
        }
        try {
          recognition.stop();
        } catch {
          cleanup();
          if (options.onEnd) options.onEnd();
        }
      },
      abort: () => {
        if (isCleanedUp) return;
        isExplicitlyAborted = true;
        try {
          recognition.abort();
        } catch {
          // ignore
        }
        cleanup();
        if (options.onEnd) options.onEnd();
      }
    };

    activeRecognitionSession = sessionHandle;
    recognition.start();

    return sessionHandle;
  } catch {
    if (activeRecognitionSession) {
      activeRecognitionSession = null;
    }
    options.onError('generic_error', getVoiceErrorMessage('generic_error', options.languageCode));
    return null;
  }
}

export type TTSState = {
  isSpeaking: boolean;
  isPaused: boolean;
  activeMessageId: string | null;
};

/**
 * Text-to-Speech synthesizer with language selection, pause/resume, and voice management
 */
export class TextToSpeechController {
  private static currentUtterance: SpeechSynthesisUtterance | null = null;
  private static activeMessageId: string | null = null;
  private static isPausedState: boolean = false;
  private static onStateChange: ((state: TTSState) => void) | null = null;

  public static setCallback(cb: (state: TTSState) => void) {
    this.onStateChange = cb;
  }

  private static notifyState(speaking: boolean, paused: boolean, msgId: string | null) {
    this.isPausedState = paused;
    this.activeMessageId = msgId;
    if (this.onStateChange) {
      this.onStateChange({
        isSpeaking: speaking,
        isPaused: paused,
        activeMessageId: msgId
      });
    }
  }

  public static stop() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    this.currentUtterance = null;
    this.isPausedState = false;
    this.notifyState(false, false, null);
  }

  public static pause() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
          window.speechSynthesis.pause();
          this.notifyState(true, true, this.activeMessageId);
        }
      } catch {
        // ignore
      }
    }
  }

  public static resume() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
          this.notifyState(true, false, this.activeMessageId);
        }
      } catch {
        // ignore
      }
    }
  }

  public static isSpeaking(messageId?: string): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    const speaking = window.speechSynthesis.speaking;
    if (!messageId) return speaking;
    return this.activeMessageId === messageId && speaking;
  }

  public static isPaused(messageId?: string): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
    const paused = window.speechSynthesis.paused || this.isPausedState;
    if (!messageId) return paused;
    return this.activeMessageId === messageId && paused;
  }

  public static cleanTextForSpeech(text: string): string {
    if (!text) return '';
    return text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, '')
      .replace(/`([^`]+)`/g, '$1')
      // Remove Markdown headings and formatting
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_([^_]+)_/g, '$1')
      .replace(/~~([^~]+)~~/g, '$1')
      // Remove Markdown links: [text](url) -> text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Clean lists and bullets
      .replace(/^[\s]*[-*+]\s+/gm, '')
      .replace(/^[\s]*\d+\.\s+/gm, '')
      // Remove HTML tags
      .replace(/<[^>]*>/g, '')
      // Remove consecutive whitespace and newlines
      .replace(/\n+/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public static speak(text: string, languageCode: string, messageId: string) {
    if (!isSpeechSynthesisSupported() || !text) return;

    this.stop();

    const cleanText = this.cleanTextForSpeech(text);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const targetLocale = SPEECH_LANG_LOCALE_MAP[languageCode] || 'en-IN';
    utterance.lang = targetLocale;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick best available voice for language (exact locale match > language prefix match)
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const voices = window.speechSynthesis.getVoices();
      if (voices && voices.length > 0) {
        const exactVoice = voices.find(v => v.lang === targetLocale || v.lang.replace('_', '-') === targetLocale);
        const prefixVoice = voices.find(v => v.lang.startsWith(languageCode) || v.lang.startsWith(targetLocale.split('-')[0]));
        if (exactVoice) {
          utterance.voice = exactVoice;
        } else if (prefixVoice) {
          utterance.voice = prefixVoice;
        }
      }
    }

    utterance.onstart = () => {
      this.notifyState(true, false, messageId);
    };

    utterance.onpause = () => {
      this.notifyState(true, true, messageId);
    };

    utterance.onresume = () => {
      this.notifyState(true, false, messageId);
    };

    utterance.onend = () => {
      this.currentUtterance = null;
      this.notifyState(false, false, null);
    };

    utterance.onerror = () => {
      this.currentUtterance = null;
      this.notifyState(false, false, null);
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }
}
