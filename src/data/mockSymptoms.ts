import { SymptomCategory, SymptomOption } from '../types/triage';

export const MOCK_SYMPTOM_CATEGORIES: SymptomCategory[] = [
  {
    id: 'fever',
    name: 'Fever & Infection',
    hindiName: 'बुखार और संक्रमण',
    teluguName: 'జ్వరం & ఇన్ఫెక్షన్',
    iconName: 'Thermometer',
    description: 'High body temperature, chills, sweating, body ache'
  },
  {
    id: 'respiratory',
    name: 'Breathing & Cough',
    hindiName: 'सांस और खांसी',
    teluguName: 'శ్వాస & దగ్గు',
    iconName: 'Wind',
    description: 'Shortness of breath, chest tightness, severe cough'
  },
  {
    id: 'gastro',
    name: 'Stomach & Digestion',
    hindiName: 'पेट और पाचन',
    teluguName: 'కడుపు & జీర్ణశక్తి',
    iconName: 'Activity',
    description: 'Vomiting, diarrhea, stomach pain, dehydration'
  },
  {
    id: 'maternal',
    name: 'Maternal & Child Health',
    hindiName: 'गर्भावस्था और बाल स्वास्थ्य',
    teluguName: 'తల్లి & పిల్లల ఆరోగ్యం',
    iconName: 'Heart',
    description: 'Pregnancy concerns, infant fever, labor signs'
  },
  {
    id: 'injury',
    name: 'Injury & Snakebite',
    hindiName: 'चोट और सर्पदंश',
    teluguName: 'గాయం & పాము కాటు',
    iconName: 'AlertTriangle',
    description: 'Cuts, snake bite, animal bite, burns, fractures'
  },
  {
    id: 'general',
    name: 'General Weakness & Pain',
    hindiName: 'कमजोरी और दर्द',
    teluguName: 'నీరసం & నొప్పి',
    iconName: 'ShieldAlert',
    description: 'Dizziness, severe headache, joint pain, fainting'
  }
];

export const MOCK_SYMPTOMS: SymptomOption[] = [
  { id: 'fever_high', categoryId: 'fever', name: 'High Fever (> 102°F)', hindiName: 'तेज़ बुखार (> 102°F)', teluguName: 'తీవ్రమైన జ్వరం (> 102°F)', description: 'Feeling extremely hot with severe shivering', isRedFlag: false },
  { id: 'fever_stiff_neck', categoryId: 'fever', name: 'Fever with Stiff Neck', hindiName: 'गर्दन में अकड़न के साथ बुखार', teluguName: 'మెడ పట్టినట్లు జ్వరం', description: 'Inability to touch chin to chest', isRedFlag: true },
  { id: 'fever_chills', categoryId: 'fever', name: 'Chills & Shivering', hindiName: 'कंपकंपी के साथ बुखार', teluguName: 'చలి జ్వరం', description: 'Intermittent fever with sweating', isRedFlag: false },

  { id: 'resp_shortness', categoryId: 'respiratory', name: 'Difficulty Breathing / Wheezing', hindiName: 'सांस लेने में तकलीफ', teluguName: 'శ్వాస తీసుకోవడంలో ఇబ్బంది', description: 'Gasping for air or chest retractions', isRedFlag: true },
  { id: 'resp_cough_blood', categoryId: 'respiratory', name: 'Coughing Blood', hindiName: 'खांसी में खून आना', teluguName: 'దగ్గులో రక్తం పడటం', description: 'Spitting or coughing reddish phlegm', isRedFlag: true },
  { id: 'resp_mild_cough', categoryId: 'respiratory', name: 'Dry Cough or Mild Phlegm', hindiName: 'सूखी या हल्की खांसी', teluguName: 'పొడి దగ్గు', description: 'Continuous throat irritation', isRedFlag: false },

  { id: 'gastro_severe_diarrhea', categoryId: 'gastro', name: 'Watery Diarrhea (5+ times/day)', hindiName: 'दस्त (दिन में 5+ बार)', teluguName: 'నీళ్ల విరేచనాలు', description: 'Frequent loose watery stools with weakness', isRedFlag: false },
  { id: 'gastro_vomiting_cant_keep_liquids', categoryId: 'gastro', name: 'Cannot Keep Any Liquid Down', hindiName: 'पानी भी नहीं पच रहा / उल्टी', teluguName: 'వాంతులు / నీరు కూడా నిలవకపోవడం', description: 'Vomiting immediately after drinking ORS/water', isRedFlag: true },
  { id: 'gastro_mild_pain', categoryId: 'gastro', name: 'Mild Stomach Cramps', hindiName: 'पेट में हल्का दर्द', teluguName: 'కడుపు నొప్పి', description: 'Dull ache around abdomen', isRedFlag: false },

  { id: 'maternal_bleeding', categoryId: 'maternal', name: 'Vaginal Bleeding in Pregnancy', hindiName: 'गर्भावस्था में रक्तस्राव', teluguName: 'గర్భధారణలో రక్తస్రావం', description: 'Any spotting or bleeding during pregnancy', isRedFlag: true },
  { id: 'maternal_reduced_movement', categoryId: 'maternal', name: 'Reduced Baby Movement', hindiName: 'बच्चे की हलचल कम होना', teluguName: 'పాప కదలికలు తగ్గడం', description: 'Fewer kicks or movements felt today', isRedFlag: true },
  { id: 'maternal_baby_fever', categoryId: 'maternal', name: 'Infant/Baby High Fever or Lethargy', hindiName: 'शिशु का तेज़ बुखार या सुस्ती', teluguName: 'పాపకు తీవ్రమైన జ్వరం', description: 'Baby refuses to feed and feels hot', isRedFlag: true },

  { id: 'injury_snakebite', categoryId: 'injury', name: 'Snake Bite or Unknown Animal Bite', hindiName: 'सांप या जानवर का काटना', teluguName: 'పాము కాటు', description: 'Fang marks, swelling, rapid numbness', isRedFlag: true },
  { id: 'injury_burn', categoryId: 'injury', name: 'Severe Burn or Blistering', hindiName: 'गंभीर रूप से जलना', teluguName: 'కాలిన గాయాలు', description: 'Skin peeling or large blisters', isRedFlag: true },
  { id: 'injury_bleeding', categoryId: 'injury', name: 'Uncontrolled Bleeding Cut', hindiName: 'गहरा घाव / लगातार खून बहना', teluguName: 'తీవ్రమైన రక్తం కారడం', description: 'Blood does not stop after 5 mins pressure', isRedFlag: true },

  { id: 'gen_dizziness', categoryId: 'general', name: 'Severe Dizziness / Fainting', hindiName: 'चक्कर आना या बेहोशी', teluguName: 'కళ్ళు తిరగడం / స్పృహ తప్పడం', description: 'Loss of balance or brief blackouts', isRedFlag: true },
  { id: 'gen_chest_pain', categoryId: 'general', name: 'Severe Chest Heavy Pain', hindiName: 'छाती में तेज़ दर्द या भारीपन', teluguName: 'ఛాతీలో తీవ్రమైన నొప్పి', description: 'Tightness radiating to left arm or neck', isRedFlag: true }
];
