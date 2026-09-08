export const SUPPORTED_LANGUAGES = [
  { 
    code: 'hi-IN', 
    label: 'Hindi', 
    nativeLabel: 'हिन्दी', 
    apiCode: 'hi', 
    flag: '🇮🇳',
    placeholder: 'योजना या छात्रवृत्ति के बारे में पूछें...',
    voiceFallbacks: ['hi-IN', 'hi_IN', 'hi', 'en-IN']
  },
  { 
    code: 'mr-IN', 
    label: 'Marathi', 
    nativeLabel: 'मराठी', 
    apiCode: 'mr', 
    flag: '🚩',
    placeholder: 'शिष्यवृत्ती किंवा योजनांबद्दल विचारा...',
    voiceFallbacks: ['mr-IN', 'mr_IN', 'mr', 'hi-IN', 'en-IN']
  },
  { 
    code: 'gu-IN', 
    label: 'Gujarati', 
    nativeLabel: 'ગુજરાતી', 
    apiCode: 'gu', 
    flag: '🏛️',
    placeholder: 'શિષ્યવૃત્તિ અથવા યોજનાઓ વિશે પૂછો...',
    voiceFallbacks: ['gu-IN', 'gu_IN', 'gu', 'hi-IN', 'en-IN']
  },
  { 
    code: 'en-IN', 
    label: 'English', 
    nativeLabel: 'English', 
    apiCode: 'en', 
    flag: '🌐',
    placeholder: 'Ask about scholarships, eligibility or benefits...',
    voiceFallbacks: ['en-IN', 'en-GB', 'en-US', 'en']
  },
];

export const DEFAULT_LANGUAGE = 'hi-IN';