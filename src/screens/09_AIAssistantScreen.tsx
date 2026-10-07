import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Mic, WifiOff, AlertTriangle, ArrowLeft, Square, Globe, ChevronDown, Check, Trash2, MoreVertical, CheckCircle2, Loader2, X, History, Plus, Edit3, MessageSquare } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../context/AuthContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useRealLocation } from '../hooks/useRealLocation';
import {
  getActiveLocation,
  fetchNearbyHealthcareCenters,
  getCachedNearbyFacilities
} from '../services/locationService';
import { ChatMessage, ChatConversation } from '../types/chat';
import { ChatBubble } from '../components/Chat/ChatBubble';
import { Disclaimer } from '../components/Common/Disclaimer';
import {
  streamChatMessageBackend,
  fetchChatHistoryBackend,
  deleteConversationBackend,
  fetchConversationsBackend,
  fetchConversationMessagesBackend,
  renameConversationBackend,
  createConversationBackend
} from '../services/api';
import { localStorageService } from '../services/localStorageService';
import {
  startSpeechRecognition,
  TextToSpeechController,
  isSpeechRecognitionSupported,
  getVoiceErrorMessage
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
  const { lang, selectedLanguageCode, switchLanguage, t } = useLanguage();
  const { user } = useAuth();
  const { isOnline, backendStatus, isBackendAvailable, isAiServiceAvailable, checkHealthNow } = useOnlineStatus();
  const { coords, address, locationSource } = useRealLocation();
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
  const voiceProcessingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceWatchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  // Voice Interaction States
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'processing'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const clearVoiceTimers = () => {
    if (voiceProcessingTimerRef.current) {
      clearTimeout(voiceProcessingTimerRef.current);
      voiceProcessingTimerRef.current = null;
    }
    if (voiceWatchdogTimerRef.current) {
      clearTimeout(voiceWatchdogTimerRef.current);
      voiceWatchdogTimerRef.current = null;
    }
  };

  const resetVoiceToIdle = () => {
    clearVoiceTimers();
    setVoiceState('idle');
    speechRecognitionRef.current = null;
  };

  // Conversations & History States
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>('conv_default');
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [activeHistoryMenuId, setActiveHistoryMenuId] = useState<string | null>(null);

  // Delete Chat & Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  // Rename Conversation States
  const [conversationToRename, setConversationToRename] = useState<ChatConversation | null>(null);
  const [renameInputTitle, setRenameInputTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Dropdown & Notice States
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);
  const [chatToastNotice, setChatToastNotice] = useState<string | null>(null);
  const [chatErrorNotice, setChatErrorNotice] = useState<string | null>(null);

  const menuDropdownRef = useRef<HTMLDivElement | null>(null);
  const historyDrawerRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const renameModalRef = useRef<HTMLDivElement | null>(null);
  const deleteButtonRef = useRef<HTMLButtonElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);

  // Click outside & Escape listener for Dropdowns, Drawer, and Modals
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (langMenuRef.current && !langMenuRef.current.contains(target)) {
        setIsLangOpen(false);
      }
      if (menuDropdownRef.current && !menuDropdownRef.current.contains(target)) {
        setShowMenuDropdown(false);
      }
      if (activeHistoryMenuId && !document.getElementById(`hist-menu-${activeHistoryMenuId}`)?.contains(target)) {
        setActiveHistoryMenuId(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLangOpen(false);
        setShowMenuDropdown(false);
        setActiveHistoryMenuId(null);
        if (!isDeletingChat) {
          setShowDeleteModal(false);
        }
        if (!isRenaming) {
          setConversationToRename(null);
        }
        setShowHistoryDrawer(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDeletingChat, isRenaming, activeHistoryMenuId]);

  // Focus management for accessibility
  useEffect(() => {
    if (showDeleteModal) {
      setTimeout(() => {
        deleteButtonRef.current?.focus();
      }, 60);
    }
  }, [showDeleteModal]);

  useEffect(() => {
    if (conversationToRename) {
      setTimeout(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
      }, 60);
    }
  }, [conversationToRename]);

  // Toast notification auto-dismiss timers
  useEffect(() => {
    if (chatToastNotice) {
      const timer = setTimeout(() => setChatToastNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [chatToastNotice]);

  useEffect(() => {
    if (chatErrorNotice) {
      const timer = setTimeout(() => setChatErrorNotice(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [chatErrorNotice]);

  useEffect(() => {
    if (voiceError) {
      const timer = setTimeout(() => setVoiceError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [voiceError]);

  useEffect(() => {
    if (voiceState !== 'idle' || speechRecognitionRef.current) {
      speechRecognitionRef.current?.abort();
      resetVoiceToIdle();
    }
  }, [selectedLanguageCode]);

  // Initial welcome message generator
  const getInitialWelcomeMessage = (): ChatMessage => ({
    id: `msg_welcome_${Date.now()}`,
    sender: 'assistant',
    text: t.welcomeChatMessage || (selectedLanguageCode === 'te'
      ? `స్వాగతం ${activePatientName}! ఈరోజు మీ ఆరోగ్యం ఎలా ఉంది?`
      : (selectedLanguageCode === 'hi'
        ? `स्वागत है ${activePatientName}! आज आप कैसा महसूस कर रहे हैं?`
        : `Welcome back ${activePatientName}. How are you feeling today?`)),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const cached = localStorageService.getChatMessages(activePatient?.id, user?.uid, currentConversationId);
    if (cached && cached.length > 0) {
      return cached;
    }
    return [
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
    ];
  });

  // Load conversation list and active chat history
  const loadConversationsAndHistory = async () => {
    if (!isOnline) {
      const cached = localStorageService.getChatMessages(activePatient?.id, user?.uid, currentConversationId);
      if (cached && cached.length > 0) {
        setMessages(cached);
      }
      return;
    }

    try {
      setIsLoadingHistory(true);
      const convList = await fetchConversationsBackend();
      if (convList && convList.length > 0) {
        setConversations(convList);
        const activeId = currentConversationId === 'conv_default' ? convList[0].id : currentConversationId;
        setCurrentConversationId(activeId);

        const msgs = await fetchConversationMessagesBackend(activeId);
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          localStorageService.saveChatMessages(msgs, activePatient?.id, user?.uid, activeId);
        } else {
          const cached = localStorageService.getChatMessages(activePatient?.id, user?.uid, activeId);
          if (cached && cached.length > 0) {
            setMessages(cached);
          }
        }
      } else {
        const hist = await fetchChatHistoryBackend(activePatient?.id, activePatientName, 'conv_default');
        if (hist && hist.length > 0) {
          setMessages(hist);
          localStorageService.saveChatMessages(hist, activePatient?.id, user?.uid, 'conv_default');
        }
      }
    } catch (err) {
      console.warn('Failed to load conversations:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadConversationsAndHistory();
  }, [activePatientName, isOnline, activePatient?.id, user?.uid]);

  // Persist messages to local storage whenever messages update
  useEffect(() => {
    if (!isDeletingChat && messages && messages.length > 0) {
      localStorageService.saveChatMessages(messages, activePatient?.id, user?.uid, currentConversationId);
    }
  }, [messages, isDeletingChat, activePatient?.id, user?.uid, currentConversationId]);

  // Select an existing conversation from Chat History
  const handleSelectConversation = async (convId: string) => {
    if (convId === currentConversationId) {
      setShowHistoryDrawer(false);
      return;
    }
    setCurrentConversationId(convId);
    setShowHistoryDrawer(false);
    setActiveHistoryMenuId(null);

    // 1. Optimistic load from local cache
    const cached = localStorageService.getChatMessages(activePatient?.id, user?.uid, convId);
    if (cached && cached.length > 0) {
      setMessages(cached);
    } else {
      setMessages([getInitialWelcomeMessage()]);
    }

    // 2. Fetch fresh messages from Firestore backend
    if (isOnline) {
      const msgs = await fetchConversationMessagesBackend(convId);
      if (msgs && msgs.length > 0) {
        setMessages(msgs);
        localStorageService.saveChatMessages(msgs, activePatient?.id, user?.uid, convId);
      }
    }
  };

  // Start a fresh, empty conversation
  const handleStartNewChat = () => {
    const newConvId = `conv_${Date.now()}`;
    setCurrentConversationId(newConvId);
    const welcome = getInitialWelcomeMessage();
    setMessages([welcome]);
    localStorageService.saveChatMessages([welcome], activePatient?.id, user?.uid, newConvId);
    setShowHistoryDrawer(false);
    setShowMenuDropdown(false);
    setActiveHistoryMenuId(null);
  };

  // Open Delete Confirmation Modal for either the active conversation or a specific conversation
  const handleOpenDeleteModal = (conv?: { id: string; title: string }) => {
    setShowMenuDropdown(false);
    setActiveHistoryMenuId(null);
    if (conv) {
      setConversationToDelete(conv);
    } else {
      const activeConv = conversations.find(c => c.id === currentConversationId);
      setConversationToDelete({
        id: currentConversationId,
        title: activeConv?.title || 'this conversation'
      });
    }
    setShowDeleteModal(true);
  };

  // Professional Delete Chat Handler
  const handleDeleteChat = async () => {
    const targetId = conversationToDelete?.id || currentConversationId;
    if (!targetId || isDeletingChat) return;

    setIsDeletingChat(true);
    setChatErrorNotice(null);

    try {
      // 1. Stop any ongoing voice or streaming synthesis
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      TextToSpeechController.stop();

      // 2. Call backend to delete conversation and all messages from Firestore
      const success = await deleteConversationBackend(targetId);
      if (!success) {
        setChatErrorNotice(t.error || 'Failed to delete conversation. Please try again.');
        setIsDeletingChat(false);
        setShowDeleteModal(false);
        return;
      }

      // 3. Clear local storage cache for this user & conversation
      localStorageService.clearChatMessages(activePatient?.id, user?.uid, targetId);

      // 4. Remove conversation from local list
      const updatedConvs = conversations.filter(c => c.id !== targetId);
      setConversations(updatedConvs);

      // 5. If the deleted conversation was the currently active one:
      if (targetId === currentConversationId) {
        const freshConvId = `conv_${Date.now()}`;
        setCurrentConversationId(freshConvId);
        const freshWelcome = getInitialWelcomeMessage();
        setMessages([freshWelcome]);
        localStorageService.saveChatMessages([freshWelcome], activePatient?.id, user?.uid, freshConvId);
      }

      // 6. Close modals and show toast notification
      setShowDeleteModal(false);
      setConversationToDelete(null);
      setShowMenuDropdown(false);
      setActiveHistoryMenuId(null);
      setChatToastNotice(t.chatDeletedToast || 'Conversation deleted successfully.');
    } catch (err: any) {
      console.error('Delete chat error:', err);
      setChatErrorNotice('Failed to delete conversation. Please try again.');
    } finally {
      setIsDeletingChat(false);
    }
  };

  // Open Rename Conversation Dialog
  const handleOpenRename = (conv: ChatConversation) => {
    setActiveHistoryMenuId(null);
    setConversationToRename(conv);
    setRenameInputTitle(conv.title);
  };

  // Save Renamed Conversation Title
  const handleSaveRename = async () => {
    if (!conversationToRename || !renameInputTitle.trim() || isRenaming) return;
    setIsRenaming(true);
    const newTitle = renameInputTitle.trim();
    try {
      const ok = await renameConversationBackend(conversationToRename.id, newTitle);
      if (ok) {
        setConversations(prev => prev.map(c => c.id === conversationToRename.id ? { ...c, title: newTitle } : c));
        setChatToastNotice(t.conversationRenamedToast || 'Conversation renamed successfully.');
        setConversationToRename(null);
      } else {
        setChatErrorNotice('Failed to rename conversation. Please try again.');
      }
    } catch {
      setChatErrorNotice('Failed to rename conversation. Please try again.');
    } finally {
      setIsRenaming(false);
    }
  };


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
      clearVoiceTimers();
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {
          // ignore
        }
        speechRecognitionRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      TextToSpeechController.stop();
    };
  }, []);

  const handleVoiceInput = () => {
    if (!isOnline || !isBackendAvailable || isTyping || isStreaming) return;

    // Check browser speech recognition support
    if (!isSpeechRecognitionSupported()) {
      setVoiceError(getVoiceErrorMessage('not_supported', selectedLanguageCode));
      resetVoiceToIdle();
      return;
    }

    // If currently listening, stop recognition cleanly and finalize
    if (voiceState === 'listening') {
      setVoiceState('processing');
      clearVoiceTimers();

      // Fallback safety watchdog: processing must NEVER hang for more than 1500ms
      voiceProcessingTimerRef.current = setTimeout(() => {
        resetVoiceToIdle();
        chatInputRef.current?.focus();
      }, 1500);

      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      return;
    }

    // If currently in processing state, clicking microphone cancels processing and returns to idle
    if (voiceState === 'processing') {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      resetVoiceToIdle();
      return;
    }

    // Clear previous audio playback, errors, and timers
    TextToSpeechController.stop();
    setVoiceError(null);
    clearVoiceTimers();

    // Abort any lingering recognition session
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }

    const recognitionInstance = startSpeechRecognition({
      languageCode: selectedLanguageCode,
      onStart: () => {
        setVoiceState('listening');
        clearVoiceTimers();

        // Safety watchdog: max 30 seconds of listening before stopping automatically
        voiceWatchdogTimerRef.current = setTimeout(() => {
          if (speechRecognitionRef.current) {
            setVoiceState('processing');
            speechRecognitionRef.current.stop();
          }
        }, 30000);
      },
      onInterimResult: (interim) => {
        setInputText(interim);
      },
      onFinalResult: (finalTranscript) => {
        clearVoiceTimers();
        if (finalTranscript) {
          setInputText(finalTranscript);
        }
        // Brief visual transition, then ensure UI returns to idle and inputs can be edited
        setVoiceState('processing');
        voiceProcessingTimerRef.current = setTimeout(() => {
          resetVoiceToIdle();
          chatInputRef.current?.focus();
        }, 350);
      },
      onError: (_errKey, errMsg) => {
        clearVoiceTimers();
        setVoiceError(errMsg);
        resetVoiceToIdle();
      },
      onEnd: () => {
        // If a brief transition timer is already running (e.g. from onFinalResult), let it complete.
        // Otherwise, immediately ensure idle state is restored.
        if (!voiceProcessingTimerRef.current) {
          resetVoiceToIdle();
          chatInputRef.current?.focus();
        } else {
          speechRecognitionRef.current = null;
        }
      }
    });

    if (!recognitionInstance) {
      resetVoiceToIdle();
    } else {
      speechRecognitionRef.current = recognitionInstance;
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

    if (voiceState !== 'idle' || speechRecognitionRef.current) {
      speechRecognitionRef.current?.abort();
      resetVoiceToIdle();
    }

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

    const activeLoc = getActiveLocation();
    const resolvedCoords = coords || activeLoc?.coords;
    const resolvedAddress = address || activeLoc?.address;
    const resolvedSource = locationSource || resolvedCoords?.source;

    const locationContextPayload = resolvedCoords ? {
      latitude: resolvedCoords.latitude,
      longitude: resolvedCoords.longitude,
      accuracy: resolvedCoords.accuracy,
      source: resolvedSource,
      addressName: resolvedAddress?.displayName
    } : undefined;

    let outgoingQuery = currentQuery;
    const isFacQuery = /hospital|phc|chc|clinic|doctor|pharmacy|ambulance|phone number|contact|address|ఆసుపత్రి|డాక్టర్|ఫోన్|అస్పతాల్|अस्पताल|डॉक्टर|फोन/i.test(currentQuery);

    if (isFacQuery && resolvedCoords) {
      try {
        let facs = getCachedNearbyFacilities();
        if (facs.length === 0) {
          facs = await fetchNearbyHealthcareCenters(resolvedCoords.latitude, resolvedCoords.longitude, 'all', 25);
        }
        if (facs.length > 0) {
          const facListStr = facs.slice(0, 4).map((f, i) =>
            `${i + 1}. ${f.name} (${f.type.toUpperCase()}) - ${f.distanceKm} km away, ${f.villageOrTaluka}, ${f.district}, Phone: ${f.phone || 'Not listed in public registry'}`
          ).join('\n');
          outgoingQuery = `${currentQuery}\n\n[Active Location: ${resolvedAddress?.displayName || 'Active GPS coordinates'}. Real Verified Nearby Healthcare Facilities:\n${facListStr}]`;
        }
      } catch (fErr) {
        console.warn('[Assistant] Facility context retrieval failed:', fErr);
      }
    }

    let receivedAnyText = false;

    try {
      const result = await streamChatMessageBackend(
        outgoingQuery,
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
        user?.id,
        locationContextPayload,
        currentConversationId
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
      if (isOnline) {
        fetchConversationsBackend().then(convList => {
          if (convList && convList.length > 0) {
            setConversations(convList);
          }
        }).catch(() => {});
      }
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
        marginBottom: '12px',
        position: 'relative'
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
              {t.assistantTitle || 'GramCare Health Assistant'}
            </h2>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              {t.patientIndicator ? `${t.patientIndicator}: ${activePatientName}` : `Patient Context: ${activePatientName}`}
            </span>
          </div>
        </div>

        {/* Header Right Actions: History, Delete & Options Menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          {/* Chat History Toggle Button */}
          <button
            type="button"
            onClick={() => {
              setShowHistoryDrawer(prev => !prev);
              setShowMenuDropdown(false);
            }}
            title={t.chatHistory || 'Chat History'}
            aria-label={t.chatHistory || 'Chat History'}
            style={{
              border: 'none',
              background: showHistoryDrawer ? '#ccfbf1' : '#f1f5f9',
              borderRadius: '10px',
              height: '38px',
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              color: showHistoryDrawer ? '#0f766e' : '#475569',
              fontWeight: 600,
              fontSize: '13px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!showHistoryDrawer) e.currentTarget.style.backgroundColor = '#e2e8f0';
            }}
            onMouseLeave={(e) => {
              if (!showHistoryDrawer) e.currentTarget.style.backgroundColor = '#f1f5f9';
            }}
          >
            <History size={17} color={showHistoryDrawer ? '#0f766e' : '#475569'} />
            <span className="chat-header-btn-text">{t.chatHistory || 'History'}</span>
            {conversations.length > 0 && (
              <span style={{
                backgroundColor: showHistoryDrawer ? '#0f766e' : '#94a3b8',
                color: '#ffffff',
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '10px',
                fontWeight: 700
              }}>
                {conversations.length}
              </span>
            )}
          </button>

          {/* Quick Trash Icon Button */}
          <button
            type="button"
            onClick={() => handleOpenDeleteModal()}
            title={t.deleteChat || 'Delete Chat'}
            aria-label={t.deleteChat || 'Delete Chat'}
            style={{
              border: 'none',
              background: '#fef2f2',
              borderRadius: '10px',
              width: '38px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#dc2626',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#fee2e2';
              e.currentTarget.style.transform = 'scale(1.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#fef2f2';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <Trash2 size={18} />
          </button>

          {/* Three-dot Options Menu Button */}
          <div ref={menuDropdownRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowMenuDropdown(prev => !prev)}
              aria-label="Chat options"
              aria-expanded={showMenuDropdown}
              style={{
                border: 'none',
                background: showMenuDropdown ? '#e2e8f0' : '#f1f5f9',
                borderRadius: '10px',
                width: '38px',
                height: '38px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#475569',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e2e8f0';
              }}
              onMouseLeave={(e) => {
                if (!showMenuDropdown) e.currentTarget.style.backgroundColor = '#f1f5f9';
              }}
            >
              <MoreVertical size={19} />
            </button>

            {/* Dropdown Menu */}
            {showMenuDropdown && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '46px',
                  backgroundColor: '#ffffff',
                  borderRadius: '14px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  border: '1px solid #e2e8f0',
                  minWidth: '220px',
                  padding: '6px',
                  zIndex: 100
                }}
              >
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#334155',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Plus size={16} color="#0f766e" />
                  <div>
                    <div>{t.newChat || 'New Chat'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                      Start fresh consultation
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenuDropdown(false);
                    setShowHistoryDrawer(true);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#334155',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f8fafc';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <History size={16} color="#475569" />
                  <div>
                    <div>{t.chatHistory || 'Chat History'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                      View past consultations
                    </div>
                  </div>
                </button>

                <div style={{ height: '1px', backgroundColor: '#f1f5f9', margin: '4px 0' }} />

                <button
                  type="button"
                  onClick={() => handleOpenDeleteModal()}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#dc2626',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    textAlign: 'left',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#fef2f2';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <Trash2 size={16} color="#dc2626" />
                  <div>
                    <div>{t.deleteChat || 'Delete Chat'}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 400 }}>
                      Permanently delete this chat
                    </div>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Slide-out Chat History Drawer */}
      {showHistoryDrawer && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="chat-history-drawer-title"
          className="overlay-animate-in"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 1100,
            display: 'flex',
            justifyContent: 'flex-end'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowHistoryDrawer(false);
              setActiveHistoryMenuId(null);
            }
          }}
        >
          <div
            ref={historyDrawerRef}
            className="drawer-animate-in"
            style={{
              width: '100%',
              maxWidth: '380px',
              height: '100%',
              backgroundColor: '#ffffff',
              boxShadow: '-8px 0 30px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}
          >
            {/* Drawer Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={20} color="#0f766e" />
                <h3 id="chat-history-drawer-title" style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: 700 }}>
                  {t.chatHistory || 'Chat History'}
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    backgroundColor: '#f0fdfa',
                    border: '1px solid #99f6e4',
                    color: '#0f766e',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ccfbf1'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f0fdfa'}
                >
                  <Plus size={14} />
                  <span>{t.newChat || 'New Chat'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryDrawer(false);
                    setActiveHistoryMenuId(null);
                  }}
                  aria-label="Close History"
                  style={{
                    border: 'none',
                    background: '#e2e8f0',
                    borderRadius: '50%',
                    width: '30px',
                    height: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#475569'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isLoadingHistory ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: '10px', color: '#0f766e' }}>
                  <Loader2 size={24} className="animate-spin" />
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Loading conversations...</span>
                </div>
              ) : conversations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    backgroundColor: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px auto'
                  }}>
                    <MessageSquare size={26} color="#94a3b8" />
                  </div>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '15px', color: '#334155', fontWeight: 600 }}>
                    {t.noConversationsFound || 'No previous conversations found'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4 }}>
                    Your consultation threads with GramCare AI will be stored securely here.
                  </p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const isActive = conv.id === currentConversationId;
                  const isMenuOpen = activeHistoryMenuId === conv.id;
                  const dateStr = conv.updatedAt || conv.createdAt;
                  const formattedDate = dateStr
                    ? new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={conv.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: '12px',
                        border: isActive ? '1.5px solid #0f766e' : '1px solid #e2e8f0',
                        backgroundColor: isActive ? '#f0fdfa' : '#ffffff',
                        boxShadow: isActive ? '0 2px 8px rgba(15, 118, 110, 0.1)' : 'none',
                        transition: 'all 0.15s ease',
                        position: 'relative'
                      }}
                    >
                      <div
                        onClick={() => handleSelectConversation(conv.id)}
                        style={{ flex: 1, minWidth: 0, cursor: 'pointer', paddingRight: '8px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            fontWeight: 700,
                            fontSize: '14px',
                            color: isActive ? '#0f766e' : '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {conv.title || 'Health Consultation'}
                          </span>
                          {isActive && (
                            <span style={{
                              backgroundColor: '#0f766e',
                              color: '#ffffff',
                              fontSize: '10px',
                              padding: '1px 6px',
                              borderRadius: '6px',
                              fontWeight: 700,
                              flexShrink: 0
                            }}>
                              Active
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {formattedDate}
                        </div>
                      </div>

                      {/* Three-dot menu button on conversation item */}
                      <div id={`hist-menu-${conv.id}`} style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveHistoryMenuId(isMenuOpen ? null : conv.id);
                          }}
                          aria-label={`Options for ${conv.title}`}
                          style={{
                            border: 'none',
                            background: isMenuOpen ? '#e2e8f0' : '#f8fafc',
                            borderRadius: '8px',
                            width: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            color: '#475569',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
                          onMouseLeave={(e) => {
                            if (!isMenuOpen) e.currentTarget.style.backgroundColor = '#f8fafc';
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Contextual Popover for Rename / Delete */}
                        {isMenuOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '36px',
                              backgroundColor: '#ffffff',
                              borderRadius: '12px',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                              border: '1px solid #e2e8f0',
                              minWidth: '150px',
                              padding: '5px',
                              zIndex: 1200
                            }}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRename(conv);
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#334155',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                textAlign: 'left',
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Edit3 size={14} color="#0f766e" />
                              <span>{t.renameChat || 'Rename'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDeleteModal(conv);
                              }}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#dc2626',
                                cursor: 'pointer',
                                fontSize: '13px',
                                fontWeight: 600,
                                textAlign: 'left',
                                transition: 'background-color 0.15s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <Trash2 size={14} color="#dc2626" />
                              <span>{t.deleteChat || 'Delete'}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-chat-modal-title"
          className="overlay-animate-in"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeletingChat) {
              setShowDeleteModal(false);
            }
          }}
        >
          <div
            ref={modalRef}
            className="modal-animate-in"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '28px 24px',
              maxWidth: '440px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #f1f5f9',
              textAlign: 'center',
              position: 'relative'
            }}
          >
            {/* Close X Button in top-right */}
            <button
              type="button"
              onClick={() => !isDeletingChat && setShowDeleteModal(false)}
              disabled={isDeletingChat}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                border: 'none',
                background: '#f8fafc',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isDeletingChat ? 'not-allowed' : 'pointer',
                color: '#64748b'
              }}
            >
              <X size={16} />
            </button>

            {/* Red Trash Icon in circular badge */}
            <div
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto',
                color: '#dc2626'
              }}
            >
              <Trash2 size={28} />
            </div>

            {/* Heading */}
            <h3
              id="delete-chat-modal-title"
              style={{
                fontSize: '19px',
                fontWeight: 700,
                color: '#0f172a',
                margin: '0 0 8px 0'
              }}
            >
              {t.deleteChatConfirmTitle || 'Delete this conversation?'}
            </h3>

            {/* Conversation badge if specific conversation title is present */}
            {conversationToDelete?.title && (
              <div
                style={{
                  display: 'inline-block',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '8px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  color: '#475569',
                  fontWeight: 600,
                  maxWidth: '320px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: '10px'
                }}
              >
                "{conversationToDelete.title}"
              </div>
            )}

            {/* Message */}
            <p
              style={{
                fontSize: '14px',
                color: '#64748b',
                lineHeight: 1.5,
                margin: '0 0 16px 0'
              }}
            >
              {t.deleteChatConfirmMsg || 'Are you sure you want to delete this conversation? This action cannot be undone.'}
            </p>

            {/* Data protection reassurance info */}
            <div
              style={{
                backgroundColor: '#f0fdfa',
                border: '1px solid #ccfbf1',
                borderRadius: '10px',
                padding: '10px 12px',
                marginBottom: '22px',
                fontSize: '12px',
                color: '#0f766e',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                textAlign: 'left'
              }}
            >
              <CheckCircle2 size={16} color="#0f766e" style={{ flexShrink: 0 }} />
              <span>
                {t.dataSafeNotice || 'Your health records, prescriptions, and profile details will remain safe and untouched.'}
              </span>
            </div>

            {/* Actions: Cancel & Delete Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeletingChat}
                style={{
                  flex: 1,
                  padding: '11px 18px',
                  borderRadius: '12px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isDeletingChat ? 'not-allowed' : 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isDeletingChat) e.currentTarget.style.backgroundColor = '#f1f5f9';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                }}
              >
                {t.cancelBtn || 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleDeleteChat}
                disabled={isDeletingChat}
                ref={deleteButtonRef}
                style={{
                  flex: 1,
                  padding: '11px 18px',
                  borderRadius: '12px',
                  border: 'none',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: isDeletingChat ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isDeletingChat) e.currentTarget.style.backgroundColor = '#b91c1c';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#dc2626';
                }}
              >
                {isDeletingChat ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>{t.deleteChat || 'Delete Chat'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Conversation Modal */}
      {conversationToRename && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-chat-modal-title"
          className="overlay-animate-in"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1250,
            padding: '16px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isRenaming) {
              setConversationToRename(null);
            }
          }}
        >
          <div
            ref={renameModalRef}
            className="modal-animate-in"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #f1f5f9',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Edit3 size={18} color="#0f766e" />
              <h3 id="rename-chat-modal-title" style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: 700 }}>
                {t.renameConversationTitle || 'Rename conversation'}
              </h3>
            </div>

            <input
              ref={renameInputRef}
              type="text"
              value={renameInputTitle}
              onChange={(e) => setRenameInputTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename();
              }}
              placeholder="Enter consultation title"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1.5px solid #cbd5e1',
                fontSize: '14px',
                marginBottom: '18px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setConversationToRename(null)}
                disabled={isRenaming}
                style={{
                  padding: '9px 16px',
                  borderRadius: '10px',
                  border: '1.5px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isRenaming ? 'not-allowed' : 'pointer'
                }}
              >
                {t.cancelBtn || 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleSaveRename}
                disabled={isRenaming || !renameInputTitle.trim()}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#0f766e',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: (isRenaming || !renameInputTitle.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {isRenaming ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification: Success */}
      {chatToastNotice && (
        <div
          role="status"
          style={{
            position: 'absolute',
            top: '56px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#0f766e',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '12px',
            boxShadow: '0 8px 20px rgba(15, 118, 110, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 900,
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          <CheckCircle2 size={16} color="#ffffff" />
          <span>{chatToastNotice}</span>
        </div>
      )}

      {/* Toast Notification: Error */}
      {chatErrorNotice && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            top: '56px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#dc2626',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '12px',
            boxShadow: '0 8px 20px rgba(220, 38, 38, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            zIndex: 900,
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          <AlertTriangle size={16} color="#ffffff" />
          <span>{chatErrorNotice}</span>
        </div>
      )}

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
            {t.offlineNotice}
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
              {t.backendUnavailableTitle}
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
            {isRetrying ? t.loading : t.retryBtn}
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
              {t.backendUnavailableTitle}
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
            {isRetrying ? t.loading : t.retryBtn}
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
            {isProcessingVoice ? (
              <Loader2 size={16} color="#2563eb" style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: '#dc2626',
                display: 'inline-block'
              }} />
            )}
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
          {isProcessingVoice && (
            <button
              type="button"
              onClick={() => {
                speechRecognitionRef.current?.abort();
                resetVoiceToIdle();
              }}
              title="Cancel"
              style={{
                border: 'none',
                background: 'none',
                color: '#2563eb',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '2px'
              }}
            >
              <X size={16} />
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
            border: isListening ? '2px solid #dc2626' : (isProcessingVoice ? '2px solid #2563eb' : '1.5px solid #cbd5e1'),
            backgroundColor: isListening ? '#fef2f2' : (isProcessingVoice ? '#eff6ff' : '#ffffff'),
            color: isListening ? '#dc2626' : (isProcessingVoice ? '#2563eb' : '#0f766e'),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isFeatureAvailable && !isTyping && !isStreaming ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
            boxShadow: isListening ? '0 0 10px rgba(220, 38, 38, 0.4)' : (isProcessingVoice ? '0 0 10px rgba(37, 99, 235, 0.3)' : '0 2px 6px rgba(0,0,0,0.03)')
          }}
        >
          {isProcessingVoice ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Mic size={20} />}
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
          ref={chatInputRef}
          type="text"
          value={inputText}
          onChange={(e) => {
            setInputText(e.target.value);
            if (voiceState === 'listening') {
              speechRecognitionRef.current?.abort();
              resetVoiceToIdle();
            }
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder={
            !isOnline
              ? t.offlineNotice
              : (!isBackendAvailable
                ? t.backendUnavailableTitle
                : (t.typeMessagePlaceholder || 'Type or speak your health question...'))
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
            title={t.stopGenerating || 'Stop generating response'}
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
