export interface TranslationDict {
  // Common & Navigation
  appName: string;
  tagline: string;
  online: string;
  offline: string;
  reconnectedToast: string;
  offlineNotice: string;
  emergencyTitle: string;
  emergencySub: string;
  sosBtn: string;
  callAmbulance: string;
  navHome: string;
  navRecords: string;
  navAssistant: string;
  navNotifications: string;
  navProfile: string;
  skip: string;
  next: string;
  getStarted: string;
  continueBtn: string;
  confirmBtn: string;
  editBtn: string;
  saveBtn: string;
  cancelBtn: string;
  backBtn: string;
  closeBtn: string;
  
  // Disclaimer
  disclaimerHeader: string;
  disclaimerBody: string;

  // Screen 01 Splash
  splashTitle: string;
  splashStatus: string;

  // Screen 02 Language
  chooseLangTitle: string;
  chooseLangSub: string;

  // Screen 03 Onboarding
  slide1Title: string;
  slide1Sub: string;
  slide2Title: string;
  slide2Sub: string;
  slide3Title: string;
  slide3Sub: string;

  // Screen 04 Auth UI
  welcomeAuth: string;
  continueGoogle: string;
  continueFacebook: string;
  continueApple: string;
  termsNotice: string;

  // Screen 05 Profile Setup
  setupTitle: string;
  fullNameLabel: string;
  dobLabel: string;
  derivedAgeLabel: string;
  heightLabel: string;
  weightLabel: string;

  // Screen 06 Profile Confirm
  confirmTitle: string;
  confirmSub: string;

  // Screen 07 Home Dashboard
  greeting: string;
  howCanHelp: string;
  actionTalk: string;
  actionCheck: string;
  actionScan: string;
  actionFamily: string;
  actionHistory: string;
  actionNearby: string;

  // Screen 08 Select Patient
  whoNeedsHelp: string;
  myself: string;
  familyMember: string;
  addFamilyMember: string;

  // Screen 09 AI Assistant
  assistantTitle: string;
  patientIndicator: string;
  typeMessagePlaceholder: string;

  // Screen 10 Triage
  triageTitle: string;
  mainComplaintLabel: string;
  durationLabel: string;
  severityLabel: string;

  // Screen 11 Triage Result
  reportedSymptomsTitle: string;
  urgencyTitle: string;
  recommendedActionTitle: string;
  findHealthcareBtn: string;
  emergencyHelpBtn: string;
  returnHomeBtn: string;

  // Screen 12 Scanner
  scannerTitle: string;
  uploadDoc: string;
  processingText: string;
  extractedInfoTitle: string;

  // Screen 13 Records
  recordsTitle: string;
  allRecords: string;

  // Screen 14 Nearby Care
  nearbyTitle: string;
  callCenter: string;
  getDirections: string;

  // Screen 15 SOS Emergency
  sosTitle: string;
  callEmergencyServices: string;

  // Screen 16 Notifications
  notificationsTitle: string;
  markAllRead: string;

  // Screen 17 Profile
  profileTitle: string;
  editProfile: string;

  // Screen 18 Settings
  settingsTitle: string;
  langSetting: string;
  clearOfflineData: string;
  aboutGramCare: string;
  logout: string;
}

export const TRANSLATIONS: Record<'en' | 'te', TranslationDict> = {
  en: {
    appName: 'GramCare AI',
    tagline: 'Rural Health Companion & Triage',
    online: 'ONLINE',
    offline: 'OFFLINE',
    reconnectedToast: "You're back online!",
    offlineNotice: 'Internet connection required for this feature.',
    emergencyTitle: 'EMERGENCY MEDICAL HELP',
    emergencySub: 'National Helpline & Ambulance',
    sosBtn: 'SOS Emergency',
    callAmbulance: 'Call 108 Ambulance',
    navHome: 'Home',
    navRecords: 'Records',
    navAssistant: 'Assistant',
    navNotifications: 'Alerts',
    navProfile: 'Profile',
    skip: 'Skip',
    next: 'Next',
    getStarted: 'Get Started',
    continueBtn: 'Continue',
    confirmBtn: 'Confirm & Continue',
    editBtn: 'Edit Details',
    saveBtn: 'Save',
    cancelBtn: 'Cancel',
    backBtn: 'Back',
    closeBtn: 'Close',

    disclaimerHeader: 'Healthcare Safety Notice',
    disclaimerBody: 'GramCare provides health guidance and does not replace professional medical care. In emergency, call 108.',

    splashTitle: 'GramCare AI',
    splashStatus: 'Initializing secure offline data and language engine...',

    chooseLangTitle: 'Choose Your Preferred Language',
    chooseLangSub: 'మీ భాషను ఎంచుకోండి',

    slide1Title: 'AI Health Assistance',
    slide1Sub: 'Instant localized guidance for common rural health concerns in your native language.',
    slide2Title: 'Symptom Triage',
    slide2Sub: 'Step-by-step symptom check to assess urgency and recommended next actions.',
    slide3Title: 'Health Records & Emergency Support',
    slide3Sub: 'Store health documents locally and access 24x7 emergency contacts offline.',

    welcomeAuth: 'Welcome to GramCare AI',
    continueGoogle: 'Continue with Google',
    continueFacebook: 'Continue with Facebook',
    continueApple: 'Continue with Apple',
    termsNotice: 'By continuing you agree to GramCare Terms of Service and Privacy Policy.',

    setupTitle: 'Set Up Your Profile',
    fullNameLabel: 'Full Name',
    dobLabel: 'Date of Birth',
    derivedAgeLabel: 'Calculated Age',
    heightLabel: 'Height (cm) — Optional',
    weightLabel: 'Weight (kg) — Optional',

    confirmTitle: 'Confirm Your Information',
    confirmSub: 'Please review your profile details before proceeding.',

    greeting: 'Hello',
    howCanHelp: 'How can GramCare help today?',
    actionTalk: 'Talk to GramCare',
    actionCheck: 'Check Symptoms',
    actionScan: 'Scan Health Record',
    actionFamily: 'Family Profiles',
    actionHistory: 'Health History',
    actionNearby: 'Find Healthcare',

    whoNeedsHelp: 'Who needs assistance?',
    myself: 'Myself',
    familyMember: 'Family Member',
    addFamilyMember: 'Add Family Member',

    assistantTitle: 'GramCare Health Assistant',
    patientIndicator: 'Assisting',
    typeMessagePlaceholder: 'Type or speak your health question...',

    triageTitle: 'Step-by-Step Symptom Check',
    mainComplaintLabel: 'Main Health Complaint',
    durationLabel: 'Symptom Duration',
    severityLabel: 'Symptom Severity',

    reportedSymptomsTitle: 'Reported Symptoms',
    urgencyTitle: 'Urgency Level',
    recommendedActionTitle: 'Recommended Next Action',
    findHealthcareBtn: 'Find Nearby Healthcare',
    emergencyHelpBtn: 'Emergency Help (108)',
    returnHomeBtn: 'Return to Home',

    scannerTitle: 'Health Document Scanner',
    uploadDoc: 'Upload Medical Report / Prescription',
    processingText: 'Extracting key medical findings...',
    extractedInfoTitle: 'Extracted Document Summary',

    recordsTitle: 'Health Records & History',
    allRecords: 'All Patient Records',

    nearbyTitle: 'Nearby Healthcare Centers',
    callCenter: 'Call Facility',
    getDirections: 'Get Directions',

    sosTitle: 'EMERGENCY ASSISTANCE',
    callEmergencyServices: 'Call National Emergency 108',

    notificationsTitle: 'Health & System Alerts',
    markAllRead: 'Mark all as read',

    profileTitle: 'My Health Profile',
    editProfile: 'Edit Profile',

    settingsTitle: 'App Settings',
    langSetting: 'App Language',
    clearOfflineData: 'Clear Offline Storage',
    aboutGramCare: 'About GramCare AI',
    logout: 'Log Out'
  },
  te: {
    appName: 'గ్రామ్‌కేర్ AI',
    tagline: 'గ్రామీణ ఆరోగ్య సహాయకుడు & రోగలక్షణ మార్గదర్శి',
    online: 'ఆన్‌లైన్',
    offline: 'ఆఫ్‌లైన్',
    reconnectedToast: 'మీరు మళ్ళీ ఆన్‌లైన్‌లోకి వచ్చారు!',
    offlineNotice: 'ఈ ఫీచర్ కోసం ఇంటర్నెట్ కనెక్షన్ అవసరం.',
    emergencyTitle: 'అత్యవసర వైద్య సహాయం',
    emergencySub: 'జాతీయ హెల్ప్‌లైన్ & అంబులెన్స్',
    sosBtn: 'SOS అత్యవసరం',
    callAmbulance: '108 అంబులెన్స్‌కు కాల్ చేయండి',
    navHome: 'హోమ్',
    navRecords: 'రికార్డులు',
    navAssistant: 'సహాయకుడు',
    navNotifications: 'అలర్ట్లు',
    navProfile: 'ప్రొఫైల్',
    skip: 'స్కిప్',
    next: 'తరువాత',
    getStarted: 'ప్రారంభించండి',
    continueBtn: 'కొనసాగించండి',
    confirmBtn: 'ధృవీకరించండి & కొనసాగించండి',
    editBtn: 'వివరాలు సవరించండి',
    saveBtn: 'సేవ్ చేయండి',
    cancelBtn: 'రద్దు చేయండి',
    backBtn: 'వెనుకకు',
    closeBtn: 'మూసివేయండి',

    disclaimerHeader: 'ఆరోగ్య భద్రతా సూచన',
    disclaimerBody: 'గ్రామ్‌కేర్ ఆరోగ్య మార్గదర్శకత్వం మాత్రమే అందిస్తుంది, వైద్యుడి సలహాను భర్తీ చేయదు. అత్యవసర పరిస్థితిలో 108 కి కాల్ చేయండి.',

    splashTitle: 'గ్రామ్‌కేర్ AI',
    splashStatus: 'సురక్షితమైన ఆఫ్‌లైన్ డేటాను సిద్ధం చేస్తోంది...',

    chooseLangTitle: 'మీ భాషను ఎంచుకోండి',
    chooseLangSub: 'Choose Your Preferred Language',

    slide1Title: 'AI ఆరోగ్య సహాయం',
    slide1Sub: 'మీ మాతృభాషలో గ్రామీణ ఆరోగ్య సమస్యలకు తక్షణ సహాయం.',
    slide2Title: 'రోగలక్షణ తనిఖీ (Triage)',
    slide2Sub: 'సమస్య తీవ్రతను మరియు తదుపరి చర్యలను తెలుసుకోవడానికి దశలవారీ తనిఖీ.',
    slide3Title: 'ఆరోగ్య రికార్డులు & అత్యవసర సేవలు',
    slide3Sub: 'ఆరోగ్య పత్రాలను ఆఫ్‌లైన్‌లో భద్రపరచండి మరియు 108 కు కాల్ చేయండి.',

    welcomeAuth: 'గ్రామ్‌కేర్ AI కి స్వాగతం',
    continueGoogle: 'Google తో కొనసాగించండి',
    continueFacebook: 'Facebook తో కొనసాగించండి',
    continueApple: 'Apple తో కొనసాగించండి',
    termsNotice: 'కొనసాగించడం ద్వారా మీరు నిబంధనలు & గోప్యతా విధానానికి అంగీకరిస్తున్నారు.',

    setupTitle: 'మీ ప్రొఫైల్ వివరాలు',
    fullNameLabel: 'పూర్తి పేరు',
    dobLabel: 'పుట్టిన తేదీ',
    derivedAgeLabel: 'లెక్కించిన వయస్సు',
    heightLabel: 'ఎత్తు (సెం.మీ) — ఐచ్ఛికం',
    weightLabel: 'బరువు (కిలోలు) — ఐచ్ఛికం',

    confirmTitle: 'మీ వివరాలను తనిఖీ చేయండి',
    confirmSub: 'కొనసాగించే ముందు మీ ప్రొఫైల్ వివరాలను సమీక్షించండి.',

    greeting: 'నమస్కారం',
    howCanHelp: 'ఈ రోజు గ్రామ్‌కేర్ మీకు ఎలా సహాయపడగలదు?',
    actionTalk: 'గ్రామ్‌కేర్‌తో మాట్లాడండి',
    actionCheck: 'లక్షణాలు తనిఖీ చేయండి',
    actionScan: 'రిపోర్ట్ స్కాన్ చేయండి',
    actionFamily: 'కుటుంబ ప్రొఫైల్స్',
    actionHistory: 'ఆరోగ్య చరిత్ర',
    actionNearby: 'ఆసుపత్రులను కనుగొనండి',

    whoNeedsHelp: 'ఎవరికి సహాయం కావాలి?',
    myself: 'నాకు (Myself)',
    familyMember: 'కుటుంబ సభ్యునికి',
    addFamilyMember: 'కుటుంబ సభ్యుడిని జోడించండి',

    assistantTitle: 'గ్రామ్‌కేర్ AI సహాయకుడు',
    patientIndicator: 'సహాయం పొందుతున్న వ్యక్తి',
    typeMessagePlaceholder: 'మీ ఆరోగ్య ప్రశ్నను టైప్ చేయండి లేదా మాట్లాడండి...',

    triageTitle: 'రోగలక్షణ తనిఖీ (Symptom Triage)',
    mainComplaintLabel: 'ప్రధాన సమస్య',
    durationLabel: 'ఎన్ని రోజుల నుండి ఉంది?',
    severityLabel: 'సమస్య తీవ్రత',

    reportedSymptomsTitle: 'తెలిపిన లక్షణాలు',
    urgencyTitle: 'అత్యవసర స్థాయి',
    recommendedActionTitle: 'సిఫార్సు చేసిన తదుపరి చర్య',
    findHealthcareBtn: 'సమీప ఆసుపత్రులు',
    emergencyHelpBtn: 'అత్యవసర సహాయం (108)',
    returnHomeBtn: 'హోమ్‌కి వెళ్లండి',

    scannerTitle: 'వైద్య పత్రాల స్కానర్',
    uploadDoc: 'పత్రం / ప్రిస్క్రిప్షన్ అప్‌లోడ్ చేయండి',
    processingText: 'పత్రంలోని వివరాలను విశ్లేషిస్తోంది...',
    extractedInfoTitle: 'పత్రం సారాంశం',

    recordsTitle: 'ఆరోగ్య రికార్డులు & చరిత్ర',
    allRecords: 'అన్ని రికార్డులు',

    nearbyTitle: 'సమీప ఆరోగ్య కేంద్రాలు',
    callCenter: 'కేంద్రానికి కాల్ చేయండి',
    getDirections: 'దారి తెలుసుకోండి',

    sosTitle: 'అత్యవసర సహాయం',
    callEmergencyServices: '108 అంబులెన్స్‌కు కాల్ చేయండి',

    notificationsTitle: 'ఆరోగ్య అలర్ట్లు',
    markAllRead: 'అన్నీ చదివినట్లు గుర్తించండి',

    profileTitle: 'నా ఆరోగ్య ప్రొఫైల్',
    editProfile: 'ప్రొఫైల్ సవరించండి',

    settingsTitle: 'యాప్ సెట్టింగ్‌లు',
    langSetting: 'యాప్ భాష',
    clearOfflineData: 'ఆఫ్‌లైన్ డేటా తీసివేయండి',
    aboutGramCare: 'గ్రామ్‌కేర్ గురించి',
    logout: 'లాగ్ అవుట్'
  }
};
