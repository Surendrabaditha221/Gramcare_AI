export type ChatSender = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  id: string;
  sender: ChatSender;
  text: string;
  teluguText?: string;
  timestamp: string;
  patientName?: string;
  isQuickOption?: boolean;
  isStreaming?: boolean;
  isInterrupted?: boolean;
  isError?: boolean;
}

export interface AssistantState {
  messages: ChatMessage[];
  isTyping: boolean;
}
