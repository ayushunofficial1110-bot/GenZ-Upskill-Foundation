/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { InternshipDomain, InterviewQuestion, InterviewIntroStep } from '../types';

export const DEFAULT_DOMAINS: InternshipDomain[] = [
  'Social Media Marketing (SMM)',
  'Content Writing (CW)',
  'AI',
];

const CONTENT_WRITING_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'cw-1',
    domain: 'Content Writing (CW)',
    questionOrder: 1,
    order: 1,
    questionText: 'Please introduce yourself and tell us a little about yourself.',
    english: 'Please introduce yourself and tell us a little about yourself.',
    hindi: 'कृपया अपना परिचय दें और अपने बारे में थोड़ा बताएं।',
    active: true,
  },
  {
    id: 'cw-2',
    domain: 'Content Writing (CW)',
    questionOrder: 2,
    order: 2,
    questionText: 'Why are you interested in Content Writing?',
    english: 'Why are you interested in Content Writing?',
    hindi: 'आप Content Writing में रुचि क्यों रखते हैं?',
    active: true,
  },
  {
    id: 'cw-3',
    domain: 'Content Writing (CW)',
    questionOrder: 3,
    order: 3,
    questionText: 'What do you think makes a piece of content interesting to read?',
    english: 'What do you think makes a piece of content interesting to read?',
    hindi: 'आपके अनुसार किसी content को पढ़ने में interesting क्या बनाता है?',
    active: true,
  },
  {
    id: 'cw-4',
    domain: 'Content Writing (CW)',
    questionOrder: 4,
    order: 4,
    questionText: 'If you have to write a post for GenZ Upskill Foundation, what topic would you choose and why?',
    english: 'If you have to write a post for GenZ Upskill Foundation, what topic would you choose and why?',
    hindi: 'अगर आपको GenZ Upskill Foundation के लिए एक post लिखनी हो, तो आप कौन-सा topic चुनेंगे और क्यों?',
    active: true,
  },
  {
    id: 'cw-5',
    domain: 'Content Writing (CW)',
    questionOrder: 5,
    order: 5,
    questionText: 'How would you write a short and interesting caption for an Instagram post?',
    english: 'How would you write a short and interesting caption for an Instagram post?',
    hindi: 'आप Instagram post के लिए एक छोटा और interesting caption कैसे लिखेंगे?',
    active: true,
  },
  {
    id: 'cw-6',
    domain: 'Content Writing (CW)',
    questionOrder: 6,
    order: 6,
    questionText: 'Written Assignment: Write a short, engaging post (3-5 sentences) or creative copy that encourages young people to learn new industry skills with GenZ Upskill Foundation.',
    english: 'Written Assignment: Write a short, engaging post (3-5 sentences) or creative copy that encourages young people to learn new industry skills with GenZ Upskill Foundation.',
    hindi: 'लिखित असाइनमेंट: एक छोटी, आकर्षक पोस्ट (3-5 वाक्य) या क्रिएटिव कॉपी लिखें जो युवाओं को GenZ Upskill Foundation के साथ नई स्किल्स सीखने के लिए प्रेरित करे।',
    active: true,
    isWrittenAnswer: true,
  },
];

/**
 * FIXED QUESTIONS CONFIGURATION
 * Exactly 6 questions per domain (3 domains = 18 questions).
 */
export const FIXED_INTERVIEW_QUESTIONS: Record<string, InterviewQuestion[]> = {
  'Social Media Marketing (SMM)': [
    {
      id: 'smm-1',
      domain: 'Social Media Marketing (SMM)',
      questionOrder: 1,
      order: 1,
      questionText: 'Please introduce yourself and tell us a little about yourself.',
      english: 'Please introduce yourself and tell us a little about yourself.',
      hindi: 'कृपया अपना परिचय दें और अपने बारे में थोड़ा बताएं।',
      active: true,
    },
    {
      id: 'smm-2',
      domain: 'Social Media Marketing (SMM)',
      questionOrder: 2,
      order: 2,
      questionText: 'Why are you interested in Social Media Marketing?',
      english: 'Why are you interested in Social Media Marketing?',
      hindi: 'आप Social Media Marketing में रुचि क्यों रखते हैं?',
      active: true,
    },
    {
      id: 'smm-3',
      domain: 'Social Media Marketing (SMM)',
      questionOrder: 3,
      order: 3,
      questionText: 'Which social media platform do you use the most, and why?',
      english: 'Which social media platform do you use the most, and why?',
      hindi: 'आप किस social media platform का सबसे ज्यादा इस्तेमाल करते हैं और क्यों?',
      active: true,
    },
    {
      id: 'smm-4',
      domain: 'Social Media Marketing (SMM)',
      questionOrder: 4,
      order: 4,
      questionText: 'If you had to promote GenZ Upskill Foundation on Instagram, what would you do first?',
      english: 'If you had to promote GenZ Upskill Foundation on Instagram, what would you do first?',
      hindi: 'अगर आपको GenZ Upskill Foundation को Instagram पर promote करना हो, तो आप सबसे पहले क्या करेंगे?',
      active: true,
    },
    {
      id: 'smm-5',
      domain: 'Social Media Marketing (SMM)',
      questionOrder: 5,
      order: 5,
      questionText: 'What makes a social media post interesting and engaging?',
      english: 'What makes a social media post interesting and engaging?',
      hindi: 'आपके अनुसार किसी social media post को interesting और engaging क्या बनाता है?',
      active: true,
    },
    {
      id: 'smm-6',
      domain: 'Social Media Marketing (SMM)',
      questionOrder: 6,
      order: 6,
      questionText: 'How would you use a simple graphic or design to make a social media post better?',
      english: 'How would you use a simple graphic or design to make a social media post better?',
      hindi: 'आप किसी social media post को बेहतर बनाने के लिए simple graphic या design का इस्तेमाल कैसे करेंगे?',
      active: true,
    },
  ],

  'Content Writing (CW)': CONTENT_WRITING_QUESTIONS,
  'Content Writing': CONTENT_WRITING_QUESTIONS,

  'AI': [
    {
      id: 'ai-1',
      domain: 'AI',
      questionOrder: 1,
      order: 1,
      questionText: 'Please introduce yourself and tell us a little about yourself.',
      english: 'Please introduce yourself and tell us a little about yourself.',
      hindi: 'कृपया अपना परिचय दें और अपने बारे में थोड़ा बताएं।',
      active: true,
    },
    {
      id: 'ai-2',
      domain: 'AI',
      questionOrder: 2,
      order: 2,
      questionText: 'Why are you interested in Artificial Intelligence?',
      english: 'Why are you interested in Artificial Intelligence?',
      hindi: 'आप Artificial Intelligence में रुचि क्यों रखते हैं?',
      active: true,
    },
    {
      id: 'ai-3',
      domain: 'AI',
      questionOrder: 3,
      order: 3,
      questionText: 'What is Artificial Intelligence in simple words?',
      english: 'What is Artificial Intelligence in simple words?',
      hindi: 'Artificial Intelligence को आप simple words में कैसे समझाएंगे?',
      active: true,
    },
    {
      id: 'ai-4',
      domain: 'AI',
      questionOrder: 4,
      order: 4,
      questionText: 'Which AI tools have you used or heard about, and what did you use them for?',
      english: 'Which AI tools have you used or heard about, and what did you use them for?',
      hindi: 'आपने कौन-कौन से AI tools इस्तेमाल किए हैं या उनके बारे में सुना है, और उनका इस्तेमाल किस काम के लिए किया?',
      active: true,
    },
    {
      id: 'ai-5',
      domain: 'AI',
      questionOrder: 5,
      order: 5,
      questionText: 'How do you think AI can help students and young people learn new skills?',
      english: 'How do you think AI can help students and young people learn new skills?',
      hindi: 'आपके अनुसार AI students और young people को नई skills सीखने में कैसे मदद कर सकता है?',
      active: true,
    },
    {
      id: 'ai-6',
      domain: 'AI',
      questionOrder: 6,
      order: 6,
      questionText: 'What is one thing people should be careful about when using AI?',
      english: 'What is one thing people should be careful about when using AI?',
      hindi: 'AI का इस्तेमाल करते समय लोगों को किस एक बात का ध्यान रखना चाहिए?',
      active: true,
    },
  ],
};

/**
 * Returns active fixed questions for a given internship domain.
 */
export function getQuestionsForDomain(domain: string): InterviewQuestion[] {
  const domainQuestions = FIXED_INTERVIEW_QUESTIONS[domain];
  if (domainQuestions && domainQuestions.length > 0) {
    return domainQuestions;
  }
  // Try normalizations
  if (domain.toLowerCase().includes('content') || domain.toLowerCase().includes('cw')) {
    return CONTENT_WRITING_QUESTIONS;
  }
  if (domain.toLowerCase().includes('ai') || domain.toLowerCase().includes('artificial')) {
    return FIXED_INTERVIEW_QUESTIONS['AI'];
  }
  return FIXED_INTERVIEW_QUESTIONS['Social Media Marketing (SMM)'];
}

/**
 * DOMAIN SPECIFIC INTRODUCTIONS
 */
export const DOMAIN_INTRODUCTIONS: Record<string, { english: string; hindi: string; title: string }> = {
  'Social Media Marketing (SMM)': {
    title: 'Domain Introduction — Social Media Marketing',
    english: 'You have selected Social Media Marketing. In this interview, we will understand your interest in social media, creativity, content ideas, and basic understanding of social media marketing.',
    hindi: 'आपने Social Media Marketing चुना है। इस interview में हम social media में आपकी रुचि, creativity, content ideas और social media marketing की basic understanding को समझेंगे।',
  },
  'Content Writing (CW)': {
    title: 'Domain Introduction — Content Writing',
    english: 'You have selected Content Writing. In this interview, we will understand your interest in writing, creativity, communication, and your ability to express ideas clearly. For the final question, you will write a short creative sample.',
    hindi: 'आपने Content Writing चुना है। इस interview में हम writing में आपकी रुचि, creativity, communication और अपने ideas को clearly express करने की ability को समझेंगे। अंतिम प्रश्न के लिए, आप एक छोटा क्रिएटिव सैंपल लिखेंगे।',
  },
  'Content Writing': {
    title: 'Domain Introduction — Content Writing',
    english: 'You have selected Content Writing. In this interview, we will understand your interest in writing, creativity, communication, and your ability to express ideas clearly. For the final question, you will write a short creative sample.',
    hindi: 'आपने Content Writing चुना है। इस interview में हम writing में आपकी रुचि, creativity, communication और अपने ideas को clearly express करने की ability को समझेंगे। अंतिम प्रश्न के लिए, आप एक छोटा क्रिएटिव सैंपल लिखेंगे।',
  },
  'AI': {
    title: 'Domain Introduction — AI',
    english: 'You have selected AI. In this interview, we will understand your interest in Artificial Intelligence, your basic understanding of AI tools and concepts, and your willingness to learn.',
    hindi: 'आपने AI चुना है। इस interview में हम Artificial Intelligence में आपकी रुचि, AI tools और concepts की basic understanding और सीखने की आपकी इच्छा को समझेंगे।',
  },
};

/**
 * Builds the exact step-by-step introduction sequence for the candidate
 */
export function getIntroStepsForDomain(domain: string): InterviewIntroStep[] {
  let domainIntro = DOMAIN_INTRODUCTIONS[domain];
  if (!domainIntro) {
    if (domain.toLowerCase().includes('content') || domain.toLowerCase().includes('cw')) {
      domainIntro = DOMAIN_INTRODUCTIONS['Content Writing (CW)'];
    } else if (domain.toLowerCase().includes('ai')) {
      domainIntro = DOMAIN_INTRODUCTIONS['AI'];
    } else {
      domainIntro = DOMAIN_INTRODUCTIONS['Social Media Marketing (SMM)'];
    }
  }

  const steps: Omit<InterviewIntroStep, 'stepNumber' | 'totalSteps'>[] = [
    {
      id: 'intro-welcome',
      title: 'Welcome',
      english: 'Welcome to GenZ Upskill Foundation. Thank you for taking the time to participate in our internship interview.',
      hindi: 'GenZ Upskill Foundation में आपका स्वागत है। हमारे internship interview में समय देने के लिए धन्यवाद।',
    },
    {
      id: 'intro-about',
      title: 'About GenZ Upskill Foundation',
      english: 'GenZ Upskill Foundation is focused on helping young people develop practical skills, gain real-world experience, and become better prepared for future opportunities. Our internship program gives students and young learners an opportunity to learn, work on practical tasks, and develop professional skills.',
      hindi: 'GenZ Upskill Foundation का उद्देश्य युवाओं को practical skills विकसित करने, real-world experience प्राप्त करने और future opportunities के लिए बेहतर तरीके से तैयार होने में मदद करना है। हमारा internship program students और young learners को सीखने, practical tasks पर काम करने और professional skills विकसित करने का अवसर देता है।',
    },
    {
      id: 'intro-instructions',
      title: 'Interview Instructions',
      english: 'This interview is designed to understand your interests, communication, basic knowledge, and willingness to learn. There are six questions in this interview. Please answer each question honestly and in your own words. You may answer in English, Hindi, or Hinglish.',
      hindi: 'यह interview आपकी interests, communication, basic knowledge और सीखने की इच्छा को समझने के लिए है। इस interview में छह questions होंगे। हर question का answer ईमानदारी से और अपने शब्दों में दें। आप English, Hindi या Hinglish में answer दे सकते हैं।',
    },
    {
      id: 'intro-domain',
      title: domainIntro.title,
      english: domainIntro.english,
      hindi: domainIntro.hindi,
    },
    {
      id: 'intro-begin',
      title: "Let's Begin Your Interview",
      english: "Thank you. Let's begin your interview.",
      hindi: 'धन्यवाद। अब आपका interview शुरू करते हैं।',
    },
  ];

  const total = steps.length;
  return steps.map((s, index) => ({
    ...s,
    stepNumber: index + 1,
    totalSteps: total,
  }));
}
