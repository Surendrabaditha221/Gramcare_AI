import { TriageInput, TriageGuidanceResult, TriageSeverity, UrgencyCategory } from '../types/triage';
import { MOCK_SYMPTOMS } from '../data/mockSymptoms';

export const mockTriageService = {
  async evaluateTriage(input: TriageInput): Promise<TriageGuidanceResult> {
    await new Promise((resolve) => setTimeout(resolve, 800));

    const selectedSymptoms = MOCK_SYMPTOMS.filter((s) =>
      input.selectedSymptomIds.includes(s.id)
    );

    const hasRedFlag = selectedSymptoms.some((s) => s.isRedFlag) || input.severity === 'Severe';

    let severity: TriageSeverity = 'low';
    let urgencyCategory: UrgencyCategory = 'Non-Urgent Guidance';
    let title = 'Mild Symptoms — Home Care & Observation';
    let teluguTitle = 'హల్కా లక్షణాలు — ఇంటి వద్ద సంరక్షణ';
    let summary = 'Your reported symptoms indicate a mild condition. Follow supportive home care.';
    let teluguSummary = 'మీరు తెలిపిన లక్షణాలు సాధారణమైనవి. తగినంత విశ్రాంతి తీసుకోండి.';

    let recommendedActions: string[] = [
      'Rest in a cool, well-ventilated room.',
      'Drink clean boiled fluids or ORS hydration.',
      'Visit PHC if symptoms persist over 48 hours.'
    ];

    let teluguRecommendedActions: string[] = [
      'తగినంత విశ్రాంతి తీసుకోండి.',
      'సాఫ్ కాచి చల్లార్చిన నీరు లేదా ORS తాగండి.',
      '48 గంటలు దాటితే ఆసుపత్రికి వెళ్ళండి.'
    ];

    if (hasRedFlag) {
      severity = 'urgent';
      urgencyCategory = 'Emergency Attention';
      title = 'URGENT ATTENTION RECOMMENDED — Visit Healthcare Center';
      teluguTitle = 'అత్యవసర శ్రద్ధ అవసరం — ఆసుపత్రికి వెళ్ళండి';
      summary = 'High priority symptoms detected. Immediate evaluation by a doctor is recommended.';
      teluguSummary = 'తీవ్రమైన లక్షణాలు గుర్తించబడ్డాయి. వెంటనే వైద్యుడిని సంప్రదించండి.';

      recommendedActions = [
        'Visit nearest Primary Health Centre (PHC) or Community Health Centre (CHC) immediately.',
        'Contact your local village ASHA worker for assistance.',
        'Call 108 Ambulance if symptoms escalate.'
      ];

      teluguRecommendedActions = [
        'వెంటనే PHC ఆసుపత్రికి వెళ్ళండి.',
        'గ్రామ ఆశా కార్యకర్తను సంప్రదించండి.',
        '108 అంబులెన్స్ సేవలను ఉపయోగించండి.'
      ];
    } else if (input.severity === 'Moderate') {
      severity = 'moderate';
      urgencyCategory = 'Seek Medical Care Soon';
      title = 'Moderate Guidance — Consult PHC Medical Officer';
      teluguTitle = 'మధ్యస్థ ప్రాధాన్యత — వైద్యుడిని కలవండి';
      summary = 'Symptoms require clinical attention to prevent dehydration or complications.';
      teluguSummary = 'లక్షణాలను గమనించి వైద్యుల సలహా తీసుకోండి.';

      recommendedActions = [
        'Consult Medical Officer at nearest Primary Health Centre (PHC).',
        'Take ORS fluid replacement.',
        'Monitor temperature regularly.'
      ];

      teluguRecommendedActions = [
        'PHC వైద్యుడిని సంప్రదించండి.',
        'ORS తాగడం ప్రారంభించండి.',
        'జ్వరం నియంత్రణలో ఉంచుకోండి.'
      ];
    }

    return {
      id: `triage_${Date.now()}`,
      patientId: input.patientId || 'user_primary',
      patientName: input.patientName || 'Primary User',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      severity,
      urgencyCategory,
      title,
      teluguTitle,
      summary,
      teluguSummary,
      reportedSymptoms: selectedSymptoms.map(s => s.name),
      teluguReportedSymptoms: selectedSymptoms.map(s => s.teluguName || s.name),
      recommendedNextActions: recommendedActions,
      teluguRecommendedNextActions: teluguRecommendedActions,
      warningSigns: hasRedFlag ? ['High Fever', 'Difficulty Breathing'] : [],
      teluguWarningSigns: hasRedFlag ? ['తీవ్రమైన జ్వరం', 'శ్వాస ఆడకపోవడం'] : [],
      redFlagWarning: hasRedFlag,
      disclaimer: 'Triage Guidance Only — GramCare AI does not replace a doctor.'
    };
  }
};
