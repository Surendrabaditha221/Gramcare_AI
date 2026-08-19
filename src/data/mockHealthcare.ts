import { HealthcareCenter, EmergencyContact } from '../types/healthCenter';

export const MOCK_FACILITIES: HealthcareCenter[] = [];

export const MOCK_EMERGENCY_HOTLINES: EmergencyContact[] = [
  {
    id: '108',
    title: 'National Ambulance Emergency',
    hindiTitle: '108 राष्ट्रीय एम्बुलेंस सेवा',
    number: '108',
    description: 'Free 24x7 medical emergency transport across India',
    hindiDescription: '24 घंटे मुफ्त आपातकालीन एम्बुलेंस सेवा',
    isPrimary: true
  },
  {
    id: '112',
    title: 'National Emergency Response (All-in-One)',
    hindiTitle: '112 राष्ट्रीय आपातकालीन नंबर',
    number: '112',
    description: 'Unified 24x7 emergency response for Medical, Police, and Fire',
    hindiDescription: '24x7 एकीकृत राष्ट्रीय आपातकालीन सहायता',
    isPrimary: true
  },
  {
    id: '102',
    title: 'Janani Shishu Suraksha (Maternal)',
    hindiTitle: '102 जननी शिशु सुरक्षा',
    number: '102',
    description: 'Free transport for pregnant mothers and newborns',
    hindiDescription: 'गर्भवती महिलाओं और नवजात शिशुओं के लिए नि:शुल्क वाहन',
    isPrimary: true
  },
  {
    id: '104',
    title: 'State Health Tele-Consultation',
    hindiTitle: '104 स्वास्थ्य सलाह हेल्पलाइन',
    number: '104',
    description: 'Government medical tele-consultation helpline',
    hindiDescription: 'सरकारी मुफ्त स्वास्थ्य परामर्श'
  }
];
