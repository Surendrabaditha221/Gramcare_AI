"""
Centralized Emergency & Patient Safety Service for GramCare AI
Provides unified red-flag detection and urgency risk assessment across:
1. Normal AI Chat
2. Voice Input / Speech Recognition
3. Symptom Triage Evaluation
4. Family Member Consultations (Pediatric & Elderly Contexts)
5. Nearby Healthcare Emergency Escalation

Strict Production Healthcare Standard:
- Never claims a medical diagnosis.
- Treats ambiguous high-risk symptoms with clinical caution.
- Zero demo data / zero fake numbers.
- Employs verified India Emergency Numbers: 108 (Ambulance), 112 (National Emergency).
"""

from typing import List, Dict, Any, Optional
import re
import logging

logger = logging.getLogger("gramcare.emergency")

# Verified India Emergency Hotlines
EMERGENCY_CONTACTS_INDIA = {
    "ambulance": "108",
    "national_emergency": "112",
    "maternal_child": "102",
    "tele_consultation": "104"
}

# Standardized Localized Emergency Notices
LOCALIZED_EMERGENCY_NOTICES = {
    "en": "⚠️ This may be a medical emergency. Please seek immediate professional medical care. If you are in India, call 108 or 112 immediately for emergency ambulance assistance or go to the nearest emergency hospital/PHC. Do not drive yourself if you feel unsafe.",
    "te": "⚠️ ఇది అత్యవసర వైద్య పరిస్థితి కావచ్చు. దయచేసి వెంటనే అత్యవసర వైద్య సహాయాన్ని పొందండి. మీరు భారతదేశంలో ఉంటే, అంబులెన్స్ సహాయం కోసం వెంటనే 108 లేదా 112 కు కాల్ చేయండి లేదా సమీపంలోని అత్యవసర ఆసుపత్రికి/PHC కి వెళ్లండి.",
    "hi": "⚠️ यह एक चिकित्सीय आपात स्थिति (Medical Emergency) हो सकती है। कृपया तुरंत आपातकालीन चिकित्सा सहायता प्राप्त करें। यदि आप भारत में हैं, तो एम्बुलेंस के लिए तुरंत 108 या 112 पर कॉल करें या नजदीकी आपातकालीन अस्पताल/PHC जाएं।",
    "ta": "⚠️ இது மருத்துவ அவசரநிலையாக இருக்கலாம். உடனடியாக அவசர மருத்துவ உதவியை நாடுங்கள். நீங்கள் இந்தியாவில் இருந்தால், ஆம்புலன்ஸுக்கு உடனடியாக 108 அல்லது 112 ஐ அழைக்கவும் அல்லது அருகிலுள்ள அவசர மருத்துவமனைக்குச் செல்லவும்.",
    "kn": "⚠️ ಇದು ವೈದ್ಯಕೀಯ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಾಗಿರಬಹುದು. ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ತುರ್ತು ವೈದ್ಯಕೀಯ ನೆರವು ಪಡೆಯಿರಿ. ನೀವು ಭಾರತದಲ್ಲಿದ್ದರೆ, ಆಂಬ್ಯುಲೆನ್ಸ್‌ಗಾಗಿ ತಕ್ಷಣ 108 ಅಥವಾ 112 ಗೆ ಕರೆ ಮಾಡಿ ಅಥವಾ ಹತ್ತಿರದ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಿ.",
    "ml": "⚠️ ഇത് ഒരു അടിയന്തര വൈദ്യസഹായ സാഹചര്യമായിരിക്കാം. ദയവായി ഉടനടി അടിയന്തര വൈദ്യസഹായം തേടുക. നിങ്ങൾ ഇന്ത്യയിലാണെങ്കിൽ, ആംബുലൻസിനായി 108 അല്ലെങ്കിൽ 112 എന്ന നമ്പറിലേക്ക് വിളിക്കുകയോ അടുത്തുള്ള അത്യാഹിത വിഭാഗത്തിൽ പോകുകയോ ചെയ്യുക."
}

# Red Flag Keyword & Regex Patterns (Multi-language: EN, TE, HI, TA, KN, ML)
RED_FLAG_PATTERNS: Dict[str, List[str]] = {
    "severe_respiratory": [
        r"\b(can'?t breathe|cannot breathe|difficulty breathing|shortness of breath|gasping|severe breathlessness|choking|suffocating|struggling to breathe|stridor|wheezing severely)\b",
        r"(శ్వాస ఆడకపోవడం|శ్వాస తీసుకోవడంలో ఇబ్బంది|ఊపిరాడటం లేదు|ఉబ్బసం తీవ్రంగా)",
        r"(सांस लेने में तकलीफ|सांस नहीं आ रही|दम घुट रहा|सांस फूल रही)",
        r"(மூச்சுத்திணறல்|மூச்சு விட முடியவில்லை)",
        r"(ಉಸಿರಾಟದ ತೊಂದರೆ|ಉಸಿರಾಡಲು ಸಾಧ್ಯವಾಗುತ್ತಿಲ್ಲ)",
        r"(ശ്വാസമെടുക്കാൻ ബുദ്ധിമുട്ട്|ശ്വാസം മുട്ടൽ)"
    ],
    "cardiac_chest_pain": [
        r"\b(chest pain|crushing chest pain|pressure in chest|heart attack|chest tightness|pain radiating to arm|pain radiating to jaw|crushing pain in chest)\b",
        r"(గుండె నొప్పి|ఛాతీలో నొప్పి|గుండెపోటు|గుండెలో తీవ్రమైన భారం)",
        r"(छाती में दर्द|सीने में दर्द|दिल का दौरा|हार्ट अटैक)",
        r"(நெஞ்சு வலி|மாரடைப்பு)",
        r"(ಎದೆ ನೋವು|ಹೃದಯಾಘಾತ)",
        r"(നെഞ്ചുവേദന|ഹൃദയാഘാതം)"
    ],
    "unconsciousness_syncope": [
        r"\b(unconscious|passed out|fainted|unresponsive|collapsed|loss of consciousness|blackout|blacked out|not waking up|comatose)\b",
        r"(స్పృహ తప్పడం|స్పృహ కోల్పోవడం|కళ్ళు తిరిగి పడిపోవడం|మేల్కొనడం లేదు)",
        r"(बेहोश|बेहोशी|होश खो बैठना|अचेत)",
        r"(மயக்கம்|நினைவிழந்த நிலை)",
        r"(ಪ್ರಜ್ಞೆ ತಪ್ಪಿ|ಪ್ರಜ್ಞಾಹೀನ)",
        r"(ബോധക്ഷയം|ബോധമില്ലാതെ വീണു)"
    ],
    "seizures_convulsions": [
        r"\b(seizure|convulsion|epileptic fit|fits|jerking uncontrollably|frothing at mouth)\b",
        r"(మూర్ఛ|ఫిట్స్|వణుకుతూ పడిపోవడం)",
        r"(दौरा|मिर्गी का दौरा|झटके आना)",
        r"(வலிப்பு|மூளை வலிப்பு)",
        r"(ಫಿಟ್ಸ್|ಮೂರ್ಛೆ)",
        r"(അപസ്മാരം|ഫിറ്റ്സ്)"
    ],
    "severe_bleeding": [
        r"\b(severe bleeding|bleeding heavily|uncontrolled bleeding|gushing blood|blood vomiting|vomiting blood|coughing blood|hemorrhage|arterial bleed)\b",
        r"(అధిక రక్తస్రావం|రక్తం వాంతులు|రక్తం ఆగడం లేదు|తీవ్ర రక్తస్రావం)",
        r"(गंभीर रक्तस्राव|खून की उल्टी|भारी खून बहना|खून बहना बंद नहीं हो रहा)",
        r"(அதிக இரத்தப்போக்கு|இரத்த வாந்தி)",
        r"(ತೀವ್ರ ರಕ್ತಸ್ರಾವ|ರಕ್ತ ವಾಂತಿ)",
        r"(കടുത്ത രക്തസ്രാവം|രക്തം ഛർദ്ദിക്കുക)"
    ],
    "stroke_neurological": [
        r"\b(stroke|facial drooping|face droop|arm weakness|slurred speech|sudden paralysis|sudden numbness on one side|sudden loss of vision|sudden blindness)\b",
        r"(పక్షవాతం|ముఖం వంకరపోవడం|మాట ముద్దవడం|చేయి పడిపోవడం)",
        r"(पक्षाघात|लकवा|स्ट्रोक|चेहरे का लटकना|आवाज लड़खड़ाना)",
        r"(பக்கவாதம்|வாய் கோணுதல்)",
        r"(ಪಾರ್ಶ್ವವಾಯು|ಮುಖ ಸೊಟ್ಟಾಗುವುದು)",
        r"(പക്ഷാഘാതം|മുഖം കോടിപ്പോവുക)"
    ],
    "anaphylaxis_allergy": [
        r"\b(anaphylaxis|severe allergic reaction|throat closing|swelling of tongue|swollen throat|swelling in lips and throat|allergic shock)\b",
        r"(తీవ్రమైన అలెర్జీ|గొంతు ఉబ్బడం|నాలుక ఉబ్బి శ్వాస ఆడకపోవడం)",
        r"(गंभीर एलर्जी|गला सूज जाना|जीभ सूजना|एनाफिलेक्सिस)",
        r"(கடுமையான ஒவ்வாமை|தொண்டை வீக்கம்)",
        r"(ತೀವ್ರ ಅಲರ್ಜಿ|ಗಂಟಲು ಊತ)",
        r"(തീവ്രമായ അലർജി|തൊണ്ട വീക്കം)"
    ],
    "poisoning_toxic": [
        r"\b(poisoning|swallowed poison|drank poison|pesticide ingestion|toxic chemical|insecticide ingestion|overdose|swallowed kerosene)\b",
        r"(విషప్రయోగం|విషం తాగడం|పురుగుల మందు తాగడం|రసాయనం తాగడం)",
        r"(जहर खाना|जहर पीना|कीटनाशक पीना|विषबाधा)",
        r"(விஷம் குடித்தல்|பூச்சிக்கொல்லி குடித்தல்)",
        r"(ವಿಷ ಸೇವನೆ|ಕ್ರಿಮಿನಾಶಕ ಸೇವನೆ)",
        r"(വിഷം കഴിക്കുക|കീടനാശിനി കുടിക്കുക)"
    ],
    "snake_bite_venom": [
        r"\b(snake bite|snakebite|venomous bite|cobra bite|viper bite|scorpion sting|stung by scorpion)\b",
        r"(పాము కాటు|పాము కరిచింది|తేలు కాటు|విషపు కాటు)",
        r"(सांप का काटना|सांप ने काट लिया|बिच्छू का डंक|विषैला दंश)",
        r"(பாம்பு கடி|தேள் கொட்டு)",
        r"(ಹಾವು ಕಡಿತ|ಚೇಳು ಕುಟುಕು)",
        r"(പാമ്പ് കടി|തേൾ കുത്ത്)"
    ],
    "severe_burns": [
        r"\b(severe burn|third degree burn|body on fire|acid burn|chemical burn|extensive burns|burst cylinder burn)\b",
        r"(తీవ్రమైన కాలిన గాయాలు|యాసిడ్ కాలడం|మంటల్లో కాలడం)",
        r"(गंभीर रूप से जलना|एसिड से जलना|आग में झुलसना)",
        r"(கடுமையான தீக்காயம்|அமிலக்காயம்)",
        r"(ತೀವ್ರ ಸುಟ್ಟ ಗಾಯ|ಆಸಿಡ್ ಸುಟ್ಟ ಗಾಯ)",
        r"(ഗുരുതരമായ പൊള്ളൽ|ആസിഡ് പൊള്ളൽ)"
    ]
}


class EmergencyService:
    """
    Unified Emergency Assessment Engine for GramCare AI.
    """

    @classmethod
    def assess_emergency(
        cls,
        user_message: str,
        recent_history: Optional[List[Dict[str, Any]]] = None,
        patient_context: Optional[Dict[str, Any]] = None,
        triage_info: Optional[Dict[str, Any]] = None,
        language: str = "en"
    ) -> Dict[str, Any]:
        """
        Evaluates input text, clinical context, and history for urgent emergency red flags.
        
        Returns:
            Dict containing:
            - isEmergency: bool
            - riskLevel: "low" | "moderate" | "urgent" | "emergency"
            - redFlags: List[str]
            - recommendedAction: str
            - requiresImmediateCare: bool
            - localizedNotice: str
            - emergencyContacts: Dict[str, str]
        """
        combined_text = (user_message or "").strip().lower()

        # Incorporate recent user turns (last 2 turns for context)
        if recent_history:
            for turn in recent_history[-2:]:
                txt = turn.get("text") or turn.get("content") or ""
                if txt:
                    combined_text += " " + txt.lower()

        # Incorporate triage complaint / symptoms if present
        if triage_info:
            complaint = triage_info.get("main_complaint") or ""
            symps = " ".join(triage_info.get("related_symptoms") or [])
            warning_signs = " ".join(triage_info.get("warning_signs") or [])
            combined_text += f" {complaint} {symps} {warning_signs}".lower()

        detected_red_flags: List[str] = []

        # 1. Evaluate Red Flag Patterns
        for category, patterns in RED_FLAG_PATTERNS.items():
            for pat in patterns:
                if re.search(pat, combined_text, re.IGNORECASE):
                    friendly_cat = category.replace("_", " ").title()
                    if friendly_cat not in detected_red_flags:
                        detected_red_flags.append(friendly_cat)
                    break

        # 2. Evaluate Patient Context Escalation (Pediatric & Elderly Caution)
        is_pediatric = False
        is_elderly = False
        if patient_context:
            age = patient_context.get("age")
            try:
                if age is not None:
                    age_num = float(age)
                    if age_num <= 5.0:
                        is_pediatric = True
                    elif age_num >= 65.0:
                        is_elderly = True
            except (ValueError, TypeError):
                pass

        # Heightened sensitivity for infants and elderly
        if is_pediatric:
            pediatric_red_flags = [
                r"\b(not feeding|refusing to drink|lethargic baby|floppy baby|blue lips|grunting|fontanelle sunken|high fever with rash)\b",
                r"(పాలు తాగడం లేదు|నీరసంగా పడిపోయిన శిశువు|పెదవులు నీలంగా)",
                r"(दूध नहीं पी रहा|सुस्त बच्चा|होंठ नीले पड़ना)"
            ]
            for pat in pediatric_red_flags:
                if re.search(pat, combined_text, re.IGNORECASE):
                    if "Pediatric Critical Distress" not in detected_red_flags:
                        detected_red_flags.append("Pediatric Critical Distress")
                    break

        if is_elderly:
            elderly_red_flags = [
                r"\b(sudden confusion|acute delirium|sudden collapse|unable to stand suddenly)\b",
                r"(అకస్మాత్తుగా స్పృహ తప్పడం|అయోమయం)",
                r"(अचानक भ्रम|अचानक गिर जाना)"
            ]
            for pat in elderly_red_flags:
                if re.search(pat, combined_text, re.IGNORECASE):
                    if "Elderly Acute Deterioration" not in detected_red_flags:
                        detected_red_flags.append("Elderly Acute Deterioration")
                    break

        # 3. Determine Urgency & Risk Level
        is_emergency = len(detected_red_flags) > 0
        risk_level = "emergency" if is_emergency else "low"
        requires_immediate_care = is_emergency

        # Triage severity override if triage explicitly reported emergency
        if triage_info and triage_info.get("severity") in ["emergency", "critical", "severe"]:
            is_emergency = True
            risk_level = "emergency"
            requires_immediate_care = True
            if "Triage Critical Flag" not in detected_red_flags:
                detected_red_flags.append("Triage Critical Flag")

        # 4. Formulate Recommended Action & Localized Notice
        if is_emergency:
            recommended_action = (
                "Seek emergency medical care immediately. Call 108 for ambulance transport or go to the nearest hospital / 24x7 emergency department."
            )
            localized_notice = LOCALIZED_EMERGENCY_NOTICES.get(language, LOCALIZED_EMERGENCY_NOTICES["en"])
        else:
            recommended_action = "Routine care and symptom monitoring."
            localized_notice = ""

        return {
            "isEmergency": is_emergency,
            "riskLevel": risk_level,
            "redFlags": detected_red_flags,
            "recommendedAction": recommended_action,
            "requiresImmediateCare": requires_immediate_care,
            "localizedNotice": localized_notice,
            "emergencyContacts": EMERGENCY_CONTACTS_INDIA
        }
