import React, { useState, useEffect } from 'react';
import { User, Bot, Volume2, VolumeX, Pause, Play, ShieldAlert, PhoneCall, MapPin } from 'lucide-react';
import { ChatMessage } from '../../types/chat';
import { TextToSpeechController, TTSState } from '../../services/voiceService';

interface ChatBubbleProps {
  message: ChatMessage;
  lang: string;
  onNavigate?: (route: string) => void;
}

const TTS_LABELS: Record<string, { play: string; pause: string; resume: string; stop: string; speaking: string }> = {
  en: { play: 'Read aloud', pause: 'Pause speech', resume: 'Resume speech', stop: 'Stop speech', speaking: 'Speaking response...' },
  te: { play: 'వాయిస్ వినండి', pause: 'వాయిస్ పాజ్ చేయండి', resume: 'వాయిస్ కొనసాగించండి', stop: 'వాయిస్ ఆపండి', speaking: 'వాయిస్ వినిపిస్తోంది...' },
  hi: { play: 'आवाज़ सुनें', pause: 'आवाज़ रोकें', resume: 'आवाज़ जारी रखें', stop: 'आवाज़ बंद करें', speaking: 'उत्तर बोला जा रहा है...' },
  ta: { play: 'குரல் கேட்கவும்', pause: 'குரலை இடைநிறுத்து', resume: 'குரலைத் தொடரவும்', stop: 'குரலை நிறுத்து', speaking: 'குரல் ஒலிக்கிறது...' },
  kn: { play: 'ಧ್ವನಿ ಆಲಿಸಿ', pause: 'ಧ್ವನಿ ವಿರಾಮಗೊಳಿಸಿ', resume: 'ಧ್ವನಿ ಮುಂದುವರಿಸಿ', stop: 'ಧ್ವನಿ ನಿಲ್ಲಿಸಿ', speaking: 'ಧ್ವನಿ ಪ್ಲೇ ಆಗುತ್ತಿದೆ...' },
  ml: { play: 'ശബ്ദം കേൾക്കുക', pause: 'ശബ്ദം നിർത്തുക', resume: 'ശബ്ദം തുടരുക', stop: 'ശബ്ദം നിർത്തുക', speaking: 'ശബ്ദം കേൾക്കുന്നു...' }
};

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, lang, onNavigate }) => {
  const isUser = message.sender === 'user';
  const text = (lang === 'te' && message.teluguText) ? message.teluguText : message.text;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const activeLang = lang in TTS_LABELS ? lang : 'en';
  const labels = TTS_LABELS[activeLang] || TTS_LABELS.en;

  useEffect(() => {
    const handleState = (state: TTSState) => {
      const isCurrentMsg = state.activeMessageId === message.id;
      setIsSpeaking(state.isSpeaking && isCurrentMsg);
      setIsPaused(state.isPaused && isCurrentMsg);
    };

    TextToSpeechController.setCallback(handleState);
    return () => {
      if (isSpeaking) {
        TextToSpeechController.stop();
      }
    };
  }, [message.id, isSpeaking]);

  const handlePlay = () => {
    setIsSpeaking(true);
    setIsPaused(false);
    TextToSpeechController.speak(text, lang, message.id);
  };

  const handlePause = () => {
    TextToSpeechController.pause();
    setIsPaused(true);
  };

  const handleResume = () => {
    TextToSpeechController.resume();
    setIsPaused(false);
  };

  const handleStop = () => {
    TextToSpeechController.stop();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const isEmergency = !isUser && Boolean(
    text && (
      text.includes('⚠️') && (
        text.toLowerCase().includes('medical emergency') ||
        text.includes('అత్యవసర') ||
        text.includes('आपात स्थिति') ||
        text.includes('URGENT MEDICAL WARNING') ||
        text.includes('Emergency Attention')
      )
    )
  );

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: '8px',
      marginBottom: '14px'
    }}>
      <div style={{
        backgroundColor: isUser ? '#0f766e' : isEmergency ? '#dc2626' : '#f1f5f9',
        color: '#ffffff',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {isUser ? <User size={16} /> : isEmergency ? <ShieldAlert size={18} color="#ffffff" /> : <Bot size={16} color="#334155" />}
      </div>

      <div style={{
        maxWidth: '85%',
        backgroundColor: isUser ? '#0f766e' : isEmergency ? '#fef2f2' : '#ffffff',
        color: isUser ? '#ffffff' : isEmergency ? '#991b1b' : '#1e293b',
        border: isUser ? 'none' : isEmergency ? '1.5px solid #f87171' : '1px solid #e2e8f0',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '12px 16px',
        boxShadow: isEmergency ? '0 4px 14px rgba(220, 38, 38, 0.15)' : '0 2px 6px rgba(0,0,0,0.04)',
        position: 'relative'
      }}>
        {!isUser && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '6px',
            borderBottom: text && !message.isStreaming ? (isEmergency ? '1px solid #fca5a5' : '1px solid #f1f5f9') : 'none',
            paddingBottom: text && !message.isStreaming ? '4px' : '0'
          }}>
            {isEmergency ? (
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#dc2626', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShieldAlert size={14} color="#dc2626" />
                Possible Medical Emergency
              </span>
            ) : message.patientName ? (
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f766e' }}>
                Assisting: {message.patientName}
              </span>
            ) : <span />}

            {/* TTS Voice Output Controls */}
            {text && !message.isStreaming && typeof window !== 'undefined' && 'speechSynthesis' in window && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {isSpeaking && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    color: isPaused ? '#d97706' : '#0f766e',
                    marginRight: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    {!isPaused && (
                      <span style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#0f766e',
                        animation: 'pulse 1s infinite'
                      }} />
                    )}
                    {isPaused ? 'Paused' : 'Playing'}
                  </span>
                )}

                {/* Play / Resume / Pause Button */}
                {!isSpeaking ? (
                  <button
                    type="button"
                    onClick={handlePlay}
                    title={labels.play}
                    aria-label={labels.play}
                    style={{
                      border: 'none',
                      background: '#f0fdf4',
                      color: '#0f766e',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    <Volume2 size={14} />
                    <span>{labels.play}</span>
                  </button>
                ) : isPaused ? (
                  <button
                    type="button"
                    onClick={handleResume}
                    title={labels.resume}
                    aria-label={labels.resume}
                    style={{
                      border: 'none',
                      background: '#fef3c7',
                      color: '#b45309',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    <Play size={13} fill="#b45309" />
                    <span>{labels.resume}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePause}
                    title={labels.pause}
                    aria-label={labels.pause}
                    style={{
                      border: 'none',
                      background: '#f1f5f9',
                      color: '#334155',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    <Pause size={13} />
                    <span>{labels.pause}</span>
                  </button>
                )}

                {/* Stop Button when active */}
                {isSpeaking && (
                  <button
                    type="button"
                    onClick={handleStop}
                    title={labels.stop}
                    aria-label={labels.stop}
                    style={{
                      border: 'none',
                      background: '#fee2e2',
                      color: '#dc2626',
                      cursor: 'pointer',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: '11px',
                      fontWeight: 600
                    }}
                  >
                    <VolumeX size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!text && !isUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 0' }}>
            <span style={{ fontSize: '13px', color: '#0f766e', fontWeight: 600 }}>
              {lang === 'te' ? 'గ్రామ్‌కేర్ ఆలోచిస్తోంది...' : 'GramCare is thinking...'}
            </span>
            <span style={{ display: 'inline-flex', gap: '3px' }}>
              <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0f766e', display: 'inline-block' }}></span>
              <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0f766e', display: 'inline-block' }}></span>
              <span className="typing-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0f766e', display: 'inline-block' }}></span>
            </span>
          </div>
        ) : (
          <p style={{ margin: 0, fontSize: '15px', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {text}
            {message.isStreaming && (
              <span
                style={{
                  display: 'inline-block',
                  width: '7px',
                  height: '14px',
                  backgroundColor: '#0f766e',
                  marginLeft: '4px',
                  verticalAlign: 'middle',
                  borderRadius: '1px',
                  animation: 'pulse 0.8s infinite'
                }}
              />
            )}
          </p>
        )}

        {message.isInterrupted && (
          <div style={{
            fontSize: '11px',
            color: '#c2410c',
            marginTop: '6px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span>⚠️ {lang === 'te' ? 'సమాధానం నిలిపివేయబడింది' : 'Response interrupted'}</span>
          </div>
        )}

        {isEmergency && !message.isStreaming && (
          <div style={{
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1.5px solid #fca5a5',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <a
              href="tel:108"
              className="btn btn-primary"
              style={{
                backgroundColor: '#dc2626',
                borderColor: '#dc2626',
                color: '#ffffff',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                textDecoration: 'none'
              }}
            >
              <PhoneCall size={13} />
              Call 108 (Ambulance)
            </a>

            <a
              href="tel:112"
              className="btn btn-outline"
              style={{
                borderColor: '#dc2626',
                color: '#dc2626',
                padding: '6px 10px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                textDecoration: 'none'
              }}
            >
              <PhoneCall size={13} />
              Call 112
            </a>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('nearby')}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #0f766e',
                  color: '#0f766e',
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  cursor: 'pointer'
                }}
              >
                <MapPin size={13} />
                Nearby Emergency Facilities
              </button>
            )}
          </div>
        )}

        <span style={{
          fontSize: '11px',
          opacity: 0.75,
          display: 'block',
          textAlign: 'right',
          marginTop: '4px'
        }}>
          {message.timestamp}
        </span>
      </div>
    </div>
  );
};
