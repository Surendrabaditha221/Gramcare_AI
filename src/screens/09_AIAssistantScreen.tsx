import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, WifiOff, AlertTriangle, ArrowLeft, Square, Globe, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ChatMessage } from '../types/chat';
import { ChatBubble } from '../components/Chat/ChatBubble';
import { Disclaimer } from '../components/Common/Disclaimer';
import { streamChatMessageBackend, fetchChatHistoryBackend } from '../services/api';
import {
  startSpeechRecognition,
  TextToSpeechController,
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported
} from '../services/voiceService';

import { ActivePatientContext } from '../hooks/usePatientSelector';

export const SUPPORTED_CHAT_LANGUAGES = [
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam' },
];

export const VOICE_STATE_LABELS: Record<string, { listening: string; processing: string; done: string; generating: string }> = {
  en: { listening: 'Listening… Speak your health question clearly', processing: 'Processing speech…', done: 'Done', generating: 'Generating response…' },
  te: { listening: 'వింటున్నారు... మీ ఆరోగ్య సమస్యను తెలుగులో మాట్లాడండి', processing: 'స్వరాన్ని ప్రాసెస్ చేస్తోంది…', done: 'పూర్తయింది', generating: 'సమాధానాన్ని రూపొందిస్తోంది…' },
  hi: { listening: 'सुन रहे हैं... कृपया अपनी स्वास्थ्य समस्या बोलें', processing: 'आवाज़ प्रोसेस हो रही है…', done: 'पूर्ण', generating: 'उत्तर तैयार किया जा रहा है…' },
  ta: { listening: 'கேட்கிறது... உங்கள் சுகாதார கேள்வியைப் பேசுங்கள்', processing: 'குரல் செயலாக்கப்படுகிறது…', done: 'முடிந்தது', generating: 'பதில் உருவாக்கப்படுகிறது…' },
  kn: { listening: 'ಆಲಿಸುತ್ತಿದೆ... ನಿಮ್ಮ ಆರೋಗ್ಯ ಪ್ರಶ್ನೆಯನ್ನು ಮಾತನಾಡಿ', processing: 'ಧ್ವನಿ ಪ್ರಕ್ರಿಯೆಗೊಳ್ಳುತ್ತಿದೆ…', done: 'ಮುಗಿದಿದೆ', generating: 'ಉತ್ತರ ರಚಿಸಲಾಗುತ್ತಿದೆ…' },
  ml: { listening: 'കേൾക്കുന്നു... നിങ്ങളുടെ ആരോഗ്യ സംശയം പറയുക', processing: 'ശബ്ദം പ്രോസസ്സ് ചെയ്യുന്നു…', done: 'പൂർത്തിയായി', generating: 'മറുപടി തയ്യാറാക്കുന്നു…' }
};

interface AIAssistantScreenProps {
  activePatientName: string;
  activePatient?: ActivePatientContext;
  onNavigate: (route: string) => void;
}

export const AIAssistantScreen: React.FC<AIAssistantScreenProps> = ({
  activePatientName,
  activePatient,
  onNavigate
}) => {
  const { lang, selectedLanguageCode, switchLanguage } = useLanguage();
  const { user } = useAuth();
  const { isOnline, backendStatus, isBackendAvailable, isAiServiceAvailable, checkHealthNow } = useOnlineStatus();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  const handleRetryBackend = async () => {
    setIsRetrying(true);
    await checkHealthNow(true);
    setIsRetrying(false);
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const speechRecognitionRef = useRef<{ stop: () => void; abort: () => void } | null>(null);

  // Voice Interaction States
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  // Click outside & Escape listener for Language Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: selectedLanguageCode === 'te'
        ? `స్వాగతం ${activePatientName}! ఈరోజు మీ ఆరోగ్యం ఎలా ఉంది?`
        : (selectedLanguageCode === 'hi'
          ? `स्वागत है ${activePatientName}! आज आप कैसा महसूस कर रहे हैं?`
          : `Welcome back ${activePatientName}. How are you feeling today?`),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Load chat history on mount
  useEffect(() => {
    async function loadHistory() {
      if (isOnline && activePatientName) {
        const history = await fetchChatHistoryBackend(activePatient?.id, activePatientName);
        if (history && history.length > 0) {
          setMessages(history);
        }
      }
    }
    loadHistory();
  }, [activePatientName, isOnline]);

  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

  const isListening = voiceState === 'listening';
  const isProcessingVoice = voiceState === 'processing';

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 80;
    setIsUserScrolledUp(!isNearBottom);
  };

  // Scroll to bottom when new messages/chunks arrive unless user scrolled up
  useEffect(() => {
    if (!isUserScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isStreaming, isUserScrolledUp]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.abort();
      }
      TextToSpeechController.stop();
    };
  }, []);

  const handleVoiceInput = () => {
    if (!isOnline || !isBackendAvailable || isTyping || isStreaming) return;

    // If currently listening, stop recognition cleanly
    if (voiceState === 'listening') {
      setVoiceState('processing');
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      return;
    }

    // Clear previous audio playback and error
    TextToSpeechController.stop();
    setVoiceError(null);

    const recognitionInstance = startSpeechRecognition({
      languageCode: selectedLanguageCode,
      onStart: () => {
        setVoiceState('listening');
      },
      onInterimResult: (interim) => {
        setInputText(interim);
      },
      onFinalResult: (finalTranscript) => {
        setVoiceState('processing');
        setInputText(finalTranscript);
        setTimeout(() => {
          setVoiceState('idle');
        }, 300);
      },
      onError: (_errKey, errMsg) => {
        setVoiceError(errMsg);
        setVoiceState('idle');
      },
      onEnd: () => {
        setVoiceState((prev) => (prev === 'listening' ? 'idle' : prev));
        speechRecognitionRef.current = null;
      }
    });

    speechRecognitionRef.current = recognitionInstance;
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setIsTyping(false);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isStreaming || isTyping) return;

    const currentQuery = inputText.trim();
    const userMsgId = `user_msg_${Date.now()}`;
    const assistantMsgId = `assistant_msg_${Date.now() + 1}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: currentQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      sender: 'assistant',
      text: '',
      patientName: activePatientName,
      isStreaming: true,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setInputText('');
    setIsUserScrolledUp(false);

    if (!isOnline) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                text: selectedLanguageCode === 'te'
                  ? 'మీరు ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు. గ్రామ్‌కేర్ AI అసిస్టెంట్‌ని ఉపయోగించడానికి ఇంటర్నెట్‌కి కనెక్ట్ అవ్వండి.'
                  : 'Internet connection required to use GramCare AI Assistant.',
                isStreaming: false
              }
            : msg
        )
      );
      return;
    }

    setIsStreaming(true);
    setIsTyping(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const patientContextPayload = activePatient ? {
      userId: user?.id,
      name: activePatient.fullName,
      age: activePatient.age,
      gender: activePatient.gender,
      relation: activePatient.relation,
      knownAllergies: activePatient.knownAllergies,
      medicalConditions: activePatient.medicalConditions,
      currentMedications: activePatient.currentMedications
    } : undefined;

    let receivedAnyText = false;

    try {
      const result = await streamChatMessageBackend(
        currentQuery,
        activePatientName,
        selectedLanguageCode,
        (chunk: string) => {
          receivedAnyText = true;
          setIsTyping(false);
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === assistantMsgId
                ? {
                    ...msg,
                    text: msg.text + chunk,
                    isStreaming: true
                  }
                : msg
            )
          );
        },
        controller.signal,
        patientContextPayload,
        messages,
        user?.id
      );

      if (result.aborted) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  isInterrupted: receivedAnyText
                }
              : msg
          )
        );
      } else if (!result.success && !receivedAnyText) {
        let errMessageText = lang === 'te'
          ? 'గ్రామ్‌కేర్ AI సేవ ప్రస్తుతం అందుబాటులో లేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.'
          : "GramCare couldn't generate a response right now. Please try again.";

        if (result.errorType === 'OFFLINE') {
          errMessageText = lang === 'te'
            ? 'మీరు ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు. గ్రామ్‌కేర్ AI అసిస్టెంట్‌ని ఉపయోగించడానికి ఇంటర్నెట్‌కి కనెక్ట్ అవ్వండి.'
            : 'Internet connection required to use GramCare AI Assistant.';
        }

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  text: errMessageText,
                  isStreaming: false
                }
              : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  isStreaming: false,
                  isInterrupted: !result.success && receivedAnyText
                }
              : msg
          )
        );
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('[GramCare Streaming Error]', err);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  text: receivedAnyText
                    ? msg.text
                    : (lang === 'te'
                      ? 'గ్రామ్‌కేర్ AI సేవ ప్రస్తుతం అందుబాటులో లేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.'
                      : "GramCare couldn't generate a response right now. Please try again."),
                  isStreaming: false,
                  isInterrupted: receivedAnyText
                }
              : msg
          )
        );
      }
    } finally {
      setIsStreaming(false);
      setIsTyping(false);
      abortControllerRef.current = null;
    }
  };

  const isFeatureAvailable = isOnline && isBackendAvailable && isAiServiceAvailable;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)', position: 'relative' }}>
      {/* Top Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '12px',
        borderBottom: '1px solid #e2e8f0',
        marginBottom: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            onClick={() => onNavigate('home')}
            style={{
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#334155'
            }}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: '#0f766e', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={20} color="#0f766e" />
              {lang === 'te' ? 'గ్రామ్‌కేర్ AI అసిస్టెంట్' : 'GramCare Health Assistant'}
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {lang === 'te' ? `రోగి: ${activePatientName}` : `Patient Context: ${activePatientName}`}
            </span>
          </div>
        </div>
      </div>

      {/* State A: Offline Internet Notice Banner */}
      {!isOnline && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <WifiOff size={18} color="#dc2626" />
          <div style={{ fontSize: '13px', color: '#dc2626', fontWeight: 600 }}>
            {lang === 'te'
              ? 'మీరు ప్రస్తుతం ఆఫ్‌లైన్‌లో ఉన్నారు. గ్రామ్‌కేర్ AI అసిస్టెంట్‌ని ఉపయోగించడానికి ఇంటర్నెట్‌కి కనెక్ట్ అవ్వండి.'
              : 'You\'re Offline. Internet connection required to use GramCare AI Assistant.'}
          </div>
        </div>
      )}

      {/* State B: Backend Service UNREACHABLE Banner */}
      {isOnline && backendStatus === 'UNREACHABLE' && (
        <div style={{
          backgroundColor: '#fff7ed',
          border: '1.5px solid #fed7aa',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#c2410c" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: '#c2410c', fontWeight: 600 }}>
              {lang === 'te'
                ? 'గ్రామ్‌కేర్ సేవ తాత్కాలికంగా అందుబాటులో లేదు.'
                : 'GramCare service is temporarily unavailable.'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetryBackend}
            disabled={isRetrying}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #c2410c',
              backgroundColor: '#ffffff',
              color: '#c2410c',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {isRetrying ? (lang === 'te' ? 'పరిశీలిస్తోంది...' : 'Checking...') : (lang === 'te' ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry Connection')}
          </button>
        </div>
      )}

      {/* State C: AI Service Unavailable Banner */}
      {isOnline && isBackendAvailable && !isAiServiceAvailable && (
        <div style={{
          backgroundColor: '#fff7ed',
          border: '1.5px solid #fed7aa',
          borderRadius: '12px',
          padding: '12px 14px',
          marginBottom: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} color="#c2410c" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: '13px', color: '#c2410c', fontWeight: 600 }}>
              {lang === 'te'
                ? 'AI అసిస్టెంట్ తాత్కాలికంగా అందుబాటులో లేదు.'
                : 'AI Assistant is temporarily unavailable.'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetryBackend}
            disabled={isRetrying}
            style={{
              padding: '6px 14px',
              borderRadius: '8px',
              border: '1px solid #c2410c',
              backgroundColor: '#ffffff',
              color: '#c2410c',
              fontSize: '12px',
              fontWeight: 700,
              cursor: isRetrying ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {isRetrying ? (lang === 'te' ? 'పరిశీలిస్తోంది...' : 'Checking...') : (lang === 'te' ? 'మళ్ళీ ప్రయత్నించండి' : 'Retry Connection')}
          </button>
        </div>
      )}

      {/* Messages Scroll View */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: 'calc(100vh - 320px)'
        }}
      >
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} lang={selectedLanguageCode} onNavigate={onNavigate} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Recognition Live Listening & Status Banner */}
      {(isListening || isProcessingVoice) && (
        <div style={{
          backgroundColor: isProcessingVoice ? '#eff6ff' : '#fef2f2',
          border: isProcessingVoice ? '1.5px solid #93c5fd' : '1.5px solid #f87171',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          animation: isListening ? 'pulse 1.5s infinite' : 'none'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: isProcessingVoice ? '#2563eb' : '#dc2626',
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: isProcessingVoice ? '#1e40af' : '#991b1b' }}>
              {isProcessingVoice
                ? (VOICE_STATE_LABELS[selectedLanguageCode]?.processing || VOICE_STATE_LABELS.en.processing)
                : (VOICE_STATE_LABELS[selectedLanguageCode]?.listening || VOICE_STATE_LABELS.en.listening)}
            </span>
          </div>
          {isListening && (
            <button
              type="button"
              onClick={handleVoiceInput}
              style={{
                border: 'none',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {VOICE_STATE_LABELS[selectedLanguageCode]?.done || VOICE_STATE_LABELS.en.done}
            </button>
          )}
        </div>
      )}

      {/* Voice Error Alert */}
      {voiceError && (
        <div style={{
          backgroundColor: '#fff7ed',
          border: '1.5px solid #fdba74',
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <div style={{ fontSize: '12px', color: '#c2410c', fontWeight: 600 }}>
            ⚠️ {voiceError}
          </div>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            style={{
              border: 'none',
              background: 'none',
              color: '#c2410c',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Medical Safety Disclaimer */}
      <div style={{ marginBottom: '12px' }}>
        <Disclaimer compact />
      </div>

      {/* Chat Input Composer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%'
      }}>
        {/* Voice Input Microphone Button */}
        <button
          type="button"
          onClick={handleVoiceInput}
          disabled={!isFeatureAvailable || isTyping || isStreaming}
          title={selectedLanguageCode === 'te' ? 'వాయిస్ ద్వారా మాట్లాడండి' : 'Speak your health question'}
          style={{
            flex: '0 0 48px',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            border: isListening ? '2px solid #dc2626' : '1.5px solid #cbd5e1',
            backgroundColor: isListening ? '#fef2f2' : '#ffffff',
            color: isListening ? '#dc2626' : '#0f766e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isFeatureAvailable && !isTyping && !isStreaming ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: isListening ? '0 0 10px rgba(220, 38, 38, 0.4)' : '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <Mic size={20} />
        </button>

        {/* 🌐 Language Button & Popover Dropdown Container */}
        <div ref={langMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
          {/* Popover Dropdown */}
          {isLangOpen && (
            <div style={{
              position: 'absolute',
              bottom: '56px',
              left: 0,
              width: '220px',
              backgroundColor: '#ffffff',
              border: '1.5px solid #cbd5e1',
              borderRadius: '14px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              zIndex: 100,
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px'
            }}>
              <div style={{
                padding: '6px 10px 4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderBottom: '1px solid #f1f5f9',
                marginBottom: '2px'
              }}>
                Select Language / భాష
              </div>

              {SUPPORTED_CHAT_LANGUAGES.map((l) => {
                const isSelected = selectedLanguageCode === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      switchLanguage(l.code);
                      setIsLangOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? '#f0fdf4' : 'transparent',
                      color: isSelected ? '#0f766e' : '#1e293b',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '13px',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span>
                      {l.code === 'en' ? 'English' : `${l.englishName} (${l.nativeName})`}
                    </span>
                    {isSelected && <Check size={16} color="#0f766e" />}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsLangOpen(!isLangOpen)}
            title="Change Assistant Language"
            style={{
              height: '48px',
              padding: '0 10px',
              borderRadius: '12px',
              border: '1.5px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
              whiteSpace: 'nowrap'
            }}
          >
            <Globe size={16} color="#0f766e" />
            <span style={{ maxWidth: '85px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {SUPPORTED_CHAT_LANGUAGES.find(l => l.code === selectedLanguageCode)?.code === 'en'
                ? 'English'
                : (SUPPORTED_CHAT_LANGUAGES.find(l => l.code === selectedLanguageCode)?.nativeName || 'English')}
            </span>
            <ChevronDown size={14} color="#64748b" />
          </button>
        </div>

        {/* Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={
            !isOnline
              ? (selectedLanguageCode === 'te' ? 'ఆఫ్‌లైన్‌లో ఉన్నప్పుడు చాట్ నిలిపివేయబడుతుంది' : 'Internet connection required to use GramCare AI Assistant.')
              : (!isBackendAvailable
                ? (selectedLanguageCode === 'te' ? 'కొన్ని ఆన్‌లైన్ సేవలు అందుబాటులో లేవు' : 'Some online services unavailable')
                : (selectedLanguageCode === 'te' ? 'మీ ఆరోగ్య సందేహాన్ని టైప్ చేయండి లేదా మాట్లాడండి...' : 'Type or speak your health question...'))
          }
          disabled={!isFeatureAvailable || isStreaming}
          style={{
            flex: 1,
            minWidth: 0,
            height: '48px',
            borderRadius: '12px',
            border: '1.5px solid #cbd5e1',
            padding: '0 14px',
            fontSize: '14px',
            color: '#1e293b',
            backgroundColor: isFeatureAvailable ? '#ffffff' : '#f8fafc',
            outline: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
          }}
        />

        {/* Dynamic Send / Stop Button */}
        {isStreaming ? (
          <button
            type="button"
            onClick={handleStop}
            title={lang === 'te' ? 'జనరేషన్ ఆపివేయండి' : 'Stop generating response'}
            style={{
              flex: '0 0 48px',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <Square size={18} fill="#ffffff" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!isFeatureAvailable || !inputText.trim() || isTyping || isStreaming}
            style={{
              flex: '0 0 48px',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              border: 'none',
              backgroundColor: (!isFeatureAvailable || !inputText.trim() || isTyping || isStreaming) ? '#94a3b8' : '#0f766e',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (!isFeatureAvailable || !inputText.trim() || isTyping || isStreaming) ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(15, 118, 110, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            <Send size={20} />
          </button>
        )}
      </div>
    </div>
  );
};
