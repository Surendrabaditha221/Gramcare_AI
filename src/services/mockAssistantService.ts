import { ChatMessage } from '../types/chat';
import { MOCK_ASSISTANT_REPLIES } from '../data/mockChat';

export const mockAssistantService = {
  async getAssistantResponse(query: string, patientName: string): Promise<ChatMessage> {
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const q = query.toLowerCase();
    let replyObj = MOCK_ASSISTANT_REPLIES.default;

    if (q.includes('fever') || q.includes('feverish') || q.includes('ताप') || q.includes('జ్వరం')) {
      replyObj = MOCK_ASSISTANT_REPLIES.fever;
    } else if (q.includes('cough') || q.includes('breath') || q.includes('సాన్స్') || q.includes('దగ్గు')) {
      replyObj = MOCK_ASSISTANT_REPLIES.cough;
    }

    return {
      id: `assistant_msg_${Date.now()}`,
      sender: 'assistant',
      text: replyObj.en,
      teluguText: replyObj.te,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      patientName
    };
  }
};
