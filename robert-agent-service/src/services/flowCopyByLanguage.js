/**
 * Localized consent question and main follow-up keyed by ISO 639-1 language code
 * (aligned with languageDetector phraseToCode and LanguageVoiceMapping.languageCode).
 */

const FLOW_COPY = {
  en: {
    consentQuestion: 'Do you consent to this call being recorded?',
    mainFollowUpQuestion: 'What would you like to do today?'
  },
  hi: {
    consentQuestion: 'क्या आप इस कॉल की रिकॉर्डिंग के लिए सहमति देते हैं?',
    mainFollowUpQuestion: 'आज आप क्या करना चाहेंगे?'
  },
  fr: {
    consentQuestion: 'Acceptez-vous que cet appel soit enregistré ?',
    mainFollowUpQuestion: "Qu'aimeriez-vous faire aujourd'hui ?"
  },
  de: {
    consentQuestion: 'Stimmen Sie der Aufzeichnung dieses Anrufs zu?',
    mainFollowUpQuestion: 'Was möchten Sie heute tun?'
  },
  es: {
    consentQuestion: '¿Consiente que esta llamada sea grabada?',
    mainFollowUpQuestion: '¿Qué le gustaría hacer hoy?'
  },
  it: {
    consentQuestion: 'Acconsenti alla registrazione di questa chiamata?',
    mainFollowUpQuestion: 'Cosa vorresti fare oggi?'
  },
  pt: {
    consentQuestion: 'Consente que esta chamada seja gravada?',
    mainFollowUpQuestion: 'O que gostaria de fazer hoje?'
  },
  nl: {
    consentQuestion: 'Geeft u toestemming om dit gesprek op te nemen?',
    mainFollowUpQuestion: 'Wat wilt u vandaag doen?'
  },
  pl: {
    consentQuestion: 'Czy wyrażasz zgodę na nagrywanie tej rozmowy?',
    mainFollowUpQuestion: 'Co chciałbyś dziś zrobić?'
  },
  si: {
    consentQuestion: 'මෙම ඇමතුම පටිගත කිරීමට ඔබ එකඟද?',
    mainFollowUpQuestion: 'ඔබ අද කුමක් කිරීමට කැමතිද?'
  },
  ta: {
    consentQuestion: 'இந்த அழைப்பைப் பதிவு செய்ய சம்மதிக்கிறீர்களா?',
    mainFollowUpQuestion: 'இன்று நீங்கள் என்ன செய்ய விரும்புகிறீர்கள்?'
  },
  bn: {
    consentQuestion: 'আপনি কি এই কল রেকর্ড করতে সম্মত?',
    mainFollowUpQuestion: 'আজ আপনি কী করতে চান?'
  },
  ur: {
    consentQuestion: 'کیا آپ اس کال کی ریکارڈنگ سے اتفاق کرتے ہیں؟',
    mainFollowUpQuestion: 'آج آپ کیا کرنا چاہیں گے؟'
  },
  pa: {
    consentQuestion: 'ਕੀ ਤੁਸੀਂ ਇਸ ਕਾਲ ਦੀ ਰਿਕਾਰਡਿੰਗ ਲਈ ਸਹਿਮਤ ਹੋ?',
    mainFollowUpQuestion: 'ਅੱਜ ਤੁਸੀਂ ਕੀ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?'
  },
  gu: {
    consentQuestion: 'શું તમે આ કોલ રેકોર્ડ કરવા સંમત છો?',
    mainFollowUpQuestion: 'આજે તમે શું કરવા માંગો છો?'
  },
  mr: {
    consentQuestion: 'तुम्ही या कॉलच्या रेकॉर्डिंगला संमती देता?',
    mainFollowUpQuestion: 'तुम्ही आज काय करू इच्छिता?'
  }
};

const EN = FLOW_COPY.en;

/**
 * @param {string | null | undefined} iso639
 * @returns {{ consentQuestion: string, mainFollowUpQuestion: string }}
 */
export function getFlowCopy(iso639) {
  if (!iso639 || typeof iso639 !== 'string') {
    return { ...EN };
  }
  const code = iso639.trim().toLowerCase().split('-')[0];
  const copy = FLOW_COPY[code];
  if (!copy) {
    return { ...EN };
  }
  return { ...copy };
}

export default { getFlowCopy };
