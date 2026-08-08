import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, WifiOff, AlertTriangle, ArrowLeft, Square } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ChatMessage } from '../types/chat';
import { ChatBubble } from '../components/Chat/ChatBubble';
import { Disclaimer } from '../components/Common/Disclaimer';
import { streamChatMessageBackend, fetchChatHistoryBackend } from '../services/api';

import { ActivePatientContext } from '../hooks/usePatientSelector';

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
  const { lang } = useLanguage();
  const { isOnline, backendStatus, isBackendAvailable, isAiServiceAvailable, checkHealthNow } = useOnlineStatus();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetryBackend = async () => {
    setIsRetrying(true);
    await checkHealthNow(true);
    setIsRetrying(false);
  };

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg_welcome',
      sender: 'assistant',
      text: lang === 'te'
        ? `స్వాగతం ${activePatientName}! ఈరోజు మీ ఆరోగ్యం ఎలా ఉంది?`
        : `Welcome back ${activePatientName}. How are you feeling today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  // Load chat history from MongoDB on mount
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
  const [isListening, setIsListening] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);

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
    };
  }, []);

  const handleVoiceInput = () => {
    if (!isOnline || !isBackendAvailable || isTyping || isStreaming) return;

    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      try {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = lang === 'te' ? 'te-IN' : 'en-IN';

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
        };
        recognition.start();
      } catch {
        setIsListening(false);
      }
    } else {
      setInputText(lang === 'te' ? 'నాకు 2 రోజులుగా జ్వరం ఉంది' : 'I have had a fever for 2 days');
    }
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
                text: lang === 'te'
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
        lang,
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
        messages
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
          <ChatBubble key={msg.id} message={msg} lang={lang} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Medical Safety Disclaimer */}
      <div style={{ marginBottom: '12px' }}>
        <Disclaimer compact />
      </div>

      {/* Chat Input Composer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        width: '100%'
      }}>
        {/* Voice Input Microphone Button */}
        <button
          type="button"
          onClick={handleVoiceInput}
          disabled={!isFeatureAvailable || isTyping || isStreaming}
          title={lang === 'te' ? 'వాయిస్ ద్వారా మాట్లాడండి' : 'Speak your health question'}
          style={{
            flex: '0 0 48px',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            border: '1.5px solid #cbd5e1',
            backgroundColor: isListening ? '#fef2f2' : '#ffffff',
            color: isListening ? '#dc2626' : '#0f766e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isFeatureAvailable && !isTyping && !isStreaming ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
          }}
        >
          <Mic size={20} />
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={
            !isOnline
              ? (lang === 'te' ? 'ఆఫ్‌లైన్‌లో ఉన్నప్పుడు చాట్ నిలిపివేయబడుతుంది' : 'Internet connection required to use GramCare AI Assistant.')
              : (!isBackendAvailable
                ? (lang === 'te' ? 'కొన్ని ఆన్‌లైన్ సేవలు అందుబాటులో లేవు' : 'Some online services unavailable')
                : (lang === 'te' ? 'మీ ఆరోగ్య సందేహాన్ని టైప్ చేయండి లేదా మాట్లాడండి...' : 'Type or speak your health question...'))
          }
          disabled={!isFeatureAvailable || isStreaming}
          style={{
            flex: 1,
            minWidth: 0,
            height: '48px',
            borderRadius: '12px',
            border: '1.5px solid #cbd5e1',
            padding: '0 16px',
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
