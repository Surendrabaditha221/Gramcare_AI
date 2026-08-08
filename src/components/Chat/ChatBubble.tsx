import React from 'react';
import { User, Bot } from 'lucide-react';
import { ChatMessage } from '../../types/chat';

interface ChatBubbleProps {
  message: ChatMessage;
  lang: 'en' | 'te';
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message, lang }) => {
  const isUser = message.sender === 'user';
  const text = (lang === 'te' && message.teluguText) ? message.teluguText : message.text;

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start',
      gap: '8px',
      marginBottom: '14px'
    }}>
      <div style={{
        backgroundColor: isUser ? '#0f766e' : '#f1f5f9',
        color: isUser ? '#ffffff' : '#334155',
        borderRadius: '50%',
        width: '32px',
        height: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div style={{
        maxWidth: '80%',
        backgroundColor: isUser ? '#0f766e' : '#ffffff',
        color: isUser ? '#ffffff' : '#1e293b',
        border: isUser ? 'none' : '1px solid #e2e8f0',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '12px 16px',
        boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
      }}>
        {!isUser && message.patientName && (
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f766e', display: 'block', marginBottom: '4px' }}>
            Assisting: {message.patientName}
          </span>
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
