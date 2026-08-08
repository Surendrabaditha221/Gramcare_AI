import { FirstAidTopic } from '../types/triage';

export const MOCK_FIRST_AID_GUIDES: FirstAidTopic[] = [
  {
    id: 'snakebite',
    title: 'Snakebite Emergency First Aid',
    hindiTitle: 'सर्पदंश (सांप के काटने पर) प्राथमिक उपचार',
    category: 'bites',
    icon: 'AlertOctagon',
    summary: 'Immediate non-panic protocol for snakebites in rural areas. Transport to nearest hospital immediately.',
    steps: [
      'Keep the patient completely calm and still. Movement spreads venom faster.',
      'Immobilize the bitten limb using a wooden stick or cloth splint below heart level.',
      'Remove tight rings, anklets, or clothing near the bite area before swelling begins.',
      'Wipe the wound gently with clean cloth. Transport immediately to PHC/Hospital with Anti-Snake Venom (ASV).'
    ],
    hindiSteps: [
      'मरीज़ को शांत रखें और बिल्कुल हिलने-डुलने न दें। भागने-दौड़ने से ज़हर तेज़ी से फैलता है।',
      'काटे गए अंग (हाथ/पैर) को हिलाएं नहीं, लकड़ी या कपड़े से सीधा बांधकर स्थिर रखें।',
      'सूजन शुरू होने से पहले अंगूठी, पायले या तंग कपड़े उतार दें।',
      'घाव को साफ कपड़े से धीरे से पोंछें और तुरंत निकटतम एंटी-स्नेक वेनम युक्त अस्पताल ले जाएं।'
    ],
    doNotDo: [
      'DO NOT cut the wound or attempt to suck venom out with mouth.',
      'DO NOT tie tight tourniquets (patti) that cut off blood circulation.',
      'DO NOT apply ice, herbs, cow dung, or traditional paste on the wound.',
      'DO NOT waste time visiting faith healers (Tantrik/Ojha).'
    ],
    hindiDoNotDo: [
      'घाव पर चीरा या कट न लगाएं और मुंह से ज़हर चूसने की कोशिश न करें।',
      'खून का बहाव पूरी तरह रोकने वाली बहुत सख्त पट्टी (टूर्निकेट) न बांधें।',
      'घाव पर बर्फ, जड़ी-बूटी, गोबर या कोई घरेलू लेप न लगाएं।',
      'झाड़-फूंक या तांत्रिक के चक्कर में समय बर्बाद न करें।'
    ],
    isAvailableOffline: true
  },
  {
    id: 'dehydration_ors',
    title: 'Severe Diarrhea & ORS Preparation',
    hindiTitle: 'दस्त और ओ.आर.एस. (ORS) का घोल बनाने की विधि',
    category: 'general',
    icon: 'Droplet',
    summary: 'Prevent fatal dehydration caused by loose motions and heatstroke in children and adults.',
    steps: [
      'Clean 1 Liter of drinking water (boiled and cooled).',
      'Add 1 full packet of ORS powder (or 6 tsp sugar + 1/2 tsp salt in 1L water if ORS unavailable).',
      'Stir until dissolved completely.',
      'Give 1/2 to 1 cup after every loose stool for adults, 1/4 cup for small children.'
    ],
    hindiSteps: [
      '1 लीटर साफ पीने का पानी लें (उबाला हुआ और ठंडा किया हुआ)।',
      'ORS पैकेट का पूरा पाउडर पानी में मिलाएं (यदि ORS न हो तो 1 लीटर पानी में 6 चम्मच चीनी + 1/2 चम्मच नमक मिलाएं)।',
      'अच्छी तरह हिलाकर घोल लें।',
      'हर बार दस्त आने के बाद बड़े व्यक्ति को 1 कप और बच्चे को आधा कप पिलाएं।'
    ],
    doNotDo: [
      'DO NOT stop giving fluids or breastmilk during diarrhea.',
      'DO NOT give sugary soft drinks, commercial juices, or plain tea.',
      'DO NOT use expired ORS packets.'
    ],
    hindiDoNotDo: [
      'दस्त के दौरान पानी, दाल का पानी या स्तनपान बंद न करें।',
      'मीठे कोल्ड ड्रिंक्स या बाजारू जूस न दें।',
      'पुराना या खुला रखा ORS घोल 24 घंटे बाद न इस्तेमाल करें।'
    ],
    isAvailableOffline: true
  },
  {
    id: 'high_fever_sponge',
    title: 'High Fever Management & Cold Sponging',
    hindiTitle: 'तेज़ बुखार और ठंडी पट्टी करने का तरीका',
    category: 'child',
    icon: 'Thermometer',
    summary: 'Safe cooling technique for infants and children with body temperature exceeding 102°F.',
    steps: [
      'Dip a clean cotton cloth in lukewarm or normal tap water (NOT ice water).',
      'Gently wipe forehead, neck, armpits, and groin area for 15-20 minutes.',
      'Dress the person in light, breathable cotton clothes.',
      'Ensure continuous intake of fluids (water, coconut water, rice kanji).'
    ],
    hindiSteps: [
      'साफ सूती कपड़े को सामान्य पानी (बर्फ का पानी नहीं) में भिगोकर निचोड़ें।',
      'माथे, गर्दन, बगल और पेट पर 15-20 मिनट तक धीरे-धीरे पट्टी करें।',
      'मरीज़ को हल्के और ढीले सूती कपड़े पहनाएं।',
      'लगातार तरल पदार्थ (पानी, नारियल पानी, चावल का मांड) पिलाते रहें।'
    ],
    doNotDo: [
      'DO NOT use ice-cold water or alcohol wipes.',
      'DO NOT wrap the feverish child in heavy blankets.',
      'DO NOT give aspirin to children under 16.'
    ],
    hindiDoNotDo: [
      'बर्फ के पानी का इस्तेमाल न करें, इससे झटका लग सकता है।',
      'बुखार से तपते बच्चे को भारी कंबलों में न लपेटें।',
      'डॉक्टर की सलाह के बिना बच्चों को कोई भी कड़ी दवाई न दें।'
    ],
    isAvailableOffline: true
  },
  {
    id: 'maternal_warning',
    title: 'Pregnancy Danger Signs & Emergency Action',
    hindiTitle: 'गर्भावस्था के खतरे के लक्षण और तुरंत उपाय',
    category: 'maternal',
    icon: 'HeartHandshake',
    summary: 'Recognizing critical pregnancy complications requiring immediate transport to CHC/District Hospital.',
    steps: [
      'If severe abdominal pain, vaginal bleeding, or fluid leakage occurs, keep mother lying down.',
      'Call emergency ambulance 108 or contact your designated village ASHA worker immediately.',
      'Keep Mother and Child Protection (MCP) card / medical documents ready for hospital transport.',
      'Ensure mother remains hydrated during transit.'
    ],
    hindiSteps: [
      'यदि पेट में तेज़ दर्द, रक्तस्राव या पानी गिरे तो माता को तुरंत लिटा दें।',
      '108 एम्बुलेंस को कॉल करें या गाँव की आशा (ASHA) कार्यकर्ता को तुरंत सूचित करें।',
      'ममत्व कार्ड (MCP Card) और सभी जांच रिपोर्ट तुरंत साथ रख लें।',
      'अस्पताल ले जाते समय माता को शांत और सहज रखें।'
    ],
    doNotDo: [
      'DO NOT delay seeking medical care if bleeding or fits occur.',
      'DO NOT perform manual abdominal massage during labor pains at home.',
      'DO NOT rely on uncertified birth attendants for high-risk deliveries.'
    ],
    hindiDoNotDo: [
      'रक्तस्राव या दौरे आने पर 1 मिनट की भी देरी न करें।',
      'घर पर प्रसव पीड़ा के दौरान पेट पर दबाव न डालें।',
      'खतरे के लक्षणों वाले मामलों में घर पर प्रसव कराने की कोशिश न करें।'
    ],
    isAvailableOffline: true
  }
];
