import { ChatMessage } from '../types/chat';

export const INITIAL_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_1',
    sender: 'assistant',
    text: 'Hello! I am GramCare AI, your rural health companion. How can I assist you or your family member today?',
    teluguText: 'నమస్కారం! నేను మీ గ్రామ్‌కేర్ AI ఆరోగ్య సహాయకుడిని. ఈ రోజు మీకు లేదా మీ కుటుంబ సభ్యులకు నేను ఎలా సహాయపడగలను?',
    timestamp: '10:00 AM'
  }
];

export const MOCK_ASSISTANT_REPLIES: Record<string, { en: string; te: string }> = {
  fever: {
    en: 'For fever, rest in a cool room, stay hydrated with ORS or boiled water, and monitor body temperature. If fever exceeds 102°F or lasts over 48 hours, please visit your nearest Primary Health Centre (PHC).',
    te: 'జ్వరం ఉన్నప్పుడు తగినంత విశ్రాంతి తీసుకోండి, ORS లేదా కాచి చల్లార్చిన నీటిని తాగండి. జ్వరం 102°F కంటే ఎక్కువ ఉంటే లేదా 48 గంటలు దాటితే వెంటనే PHC ఆసుపత్రికి వెళ్ళండి.'
  },
  cough: {
    en: 'Drink warm fluids, honey with ginger, and avoid cold air exposure. If coughing blood or experiencing breathlessness, seek immediate emergency care.',
    te: 'గోరువెచ్చని నీరు లేదా అల్లం తేనె తీసుకోండి. శ్వాస తీసుకోవడంలో ఇబ్బంది ఉంటే వెంటనే ఆసుపత్రికి వెళ్ళండి.'
  },
  default: {
    en: 'Thank you for sharing your symptoms. Based on your input, please ensure adequate rest and fluid intake. If symptoms worsen, use our Symptom Triage tool or consult the Medical Officer at nearest Primary Health Centre (PHC).',
    te: 'మీ వివరాలకు ధన్యవాదాలు. తగినంత విశ్రాంతి తీసుకోండి. సమస్య ఎక్కువైతే సింప్టమ్ తనిఖీ (Triage) ని ఉపయోగించండి లేదా ఆసుపత్రి వైద్యుడిని సంప్రదించండి.'
  }
};
