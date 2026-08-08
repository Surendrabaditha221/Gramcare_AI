import { HealthcareCenter, EmergencyContact } from '../types/healthCenter';

export const MOCK_EMERGENCY_CONTACTS: EmergencyContact[] = [
  {
    id: '108',
    title: 'National Ambulance Emergency Service',
    hindiTitle: '108 राष्ट्रीय एम्बुलेंस आपातकालीन सेवा',
    number: '108',
    description: 'Free 24/7 medical emergency transport service across India',
    hindiDescription: '24 घंटे नि:शुल्क आपातकालीन एम्बुलेंस सेवा',
    isPrimary: true
  },
  {
    id: '102',
    title: 'Janani Shishu Suraksha (Maternal & Child)',
    hindiTitle: '102 जननी शिशु सुरक्षा एम्बुलेंस',
    number: '102',
    description: 'Free transport for pregnant women and sick infants to government facilities',
    hindiDescription: 'गर्भवती महिलाओं और नवजात शिशुओं के लिए मुफ्त वाहन सेवा',
    isPrimary: true
  },
  {
    id: '104',
    title: 'State Health Helpline & Medical Advice',
    hindiTitle: '104 स्वास्थ्य परामर्श हेल्पलाइन',
    number: '104',
    description: 'Government tele-consultation and health information helpline',
    hindiDescription: 'सरकारी स्वास्थ्य जानकारी और चिकित्सा सलाह हेल्पलाइन'
  },
];

export const MOCK_HEALTHCARE_CENTERS: HealthcareCenter[] = [];
