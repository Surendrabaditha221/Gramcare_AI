import { TriageInput, TriageGuidanceResult } from '../types/triage';

export function evaluateLocalDeterministicTriage(input: TriageInput): TriageGuidanceResult {
  const complaintLower = (input.mainComplaint || '').toLowerCase();
  const detailsLower = (input.additionalDetails || '').toLowerCase();
  const warningSigns = input.warningSigns || [];
  const selectedSymptoms = input.selectedSymptomIds || [];

  const RED_FLAG_KEYWORDS = [
    'chest pain', 'heart attack', 'shortness of breath', 'difficulty breathing',
    'severe bleeding', 'unconscious', 'fainting', 'stroke', 'numbness',
    'paralysis', 'seizure', 'severe burn', 'head injury', 'stiff neck'
  ];

  const hasRedFlagKeyword = RED_FLAG_KEYWORDS.some(
    kw => complaintLower.includes(kw) || detailsLower.includes(kw)
  );

  const isHighSeverity = input.severity === 'Severe' || warningSigns.length > 0 || hasRedFlagKeyword;

  if (isHighSeverity) {
    return {
      id: `offline_triage_${Date.now()}`,
      patientId: input.patientId || 'user_primary',
      patientName: input.patientName || 'Primary User',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      severity: 'urgent',
      urgencyCategory: 'Emergency Attention',
      title: 'EMERGENCY: Immediate Medical Care Advised',
      teluguTitle: 'అత్యవసర పరిస్థితి: వెంటనే వైద్య సహాయం పొందండి',
      summary: 'Reported symptoms contain critical emergency warning signs requiring immediate clinical evaluation.',
      teluguSummary: 'తెలిపిన లక్షణాలలో అత్యవసర వైద్య సంరక్షణ అవసరమయ్యే ప్రమాదకర సూచనలు ఉన్నాయి.',
      reportedSymptoms: [input.mainComplaint, ...selectedSymptoms],
      teluguReportedSymptoms: [input.mainComplaint, ...selectedSymptoms],
      recommendedNextActions: [
        'Call 108 Emergency Ambulance service immediately.',
        'Keep patient calm, seated or lying down comfortably.',
        'Do not give oral fluids or medication if unconscious or severe distress.',
        'Proceed to nearest Primary Health Center (PHC) or General Hospital.'
      ],
      teluguRecommendedNextActions: [
        'వెంటనే 108 అంబులెన్స్ సేవకు కాల్ చేయండి.',
        'బాధితుడిని ప్రశాంతంగా, సౌకర్యవంతంగా ఉంచండి.',
        'స్పృహ లేకపోతే ఆహారం లేదా నీరు ఇవ్వవద్దు.',
        'సమీపంలోని ప్రాథమిక ఆరోగ్య కేంద్రం (PHC) కు తీసుకెళ్లండి.'
      ],
      warningSigns: [
        'Chest pressure or radiation to arms/jaw',
        'Inability to speak clearly or facial drooping',
        'Severe breathlessness at rest',
        'Uncontrolled bleeding'
      ],
      teluguWarningSigns: [
        'ఛాతీలో నొప్పి లేదా ఒత్తిడి',
        'మాట్లాడటంలో ఇబ్బంది లేదా ముఖం వంకరపోవడం',
        'తీవ్రమైన శ్వాస ఇబ్బంది'
      ],
      redFlagWarning: true,
      disclaimer: 'GramCare Offline Emergency Safety Protocol (Local Deterministic Rules — Internet Offline)'
    };
  }

  return {
    id: `offline_triage_${Date.now()}`,
    patientId: input.patientId || 'user_primary',
    patientName: input.patientName || 'Primary User',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    severity: 'moderate',
    urgencyCategory: 'Non-Urgent Guidance',
    title: 'Routine Health Symptom Care',
    teluguTitle: 'సాధారణ ఆరోగ్య లక్షణాల సంరక్షణ',
    summary: 'No immediate red-flag indicators detected. Follow basic first aid and consult local healthcare provider.',
    teluguSummary: 'వెంటనే ప్రమాదకర సూచనలు ఏవీ కనిపించలేదు. ప్రాథమిక చికిత్స పాటించండి.',
    reportedSymptoms: [input.mainComplaint, ...selectedSymptoms],
    teluguReportedSymptoms: [input.mainComplaint, ...selectedSymptoms],
    recommendedNextActions: [
      'Rest comfortably and maintain hydration with ORS / clean water.',
      'Monitor body temperature and symptoms closely.',
      'Visit local Primary Health Center (PHC) if symptoms persist past 24 hours.'
    ],
    teluguRecommendedNextActions: [
      'విశ్రాంతి తీసుకోండి మరియు స్వచ్ఛమైన నీరు తాగండి.',
      'శరీర ఉష్ణోగ్రత మరియు లక్షణాలను గమనించండి.',
      'లక్షణాలు తగ్గకపోతే సమీప PHC ని సందర్శించండి.'
    ],
    warningSigns: [
      'Seek emergency care if high fever or breathlessness develops.'
    ],
    teluguWarningSigns: [
      'తీవ్ర జ్వరం లేదా శ్వాసక్రియ ఇబ్బంది వస్తే 108 కు కాల్ చేయండి.'
    ],
    redFlagWarning: false,
    disclaimer: 'GramCare Offline Emergency Safety Protocol (Local Deterministic Rules — Internet Offline)'
  };
}
