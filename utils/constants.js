/**
 * X Auto Reply Assistant
 * Copyright (c) 2025 TherealPourya
 * Email: hexQuant@gmail.com
 * X (Twitter): @TherealPourya
 * 
 * All rights reserved. This software is proprietary and confidential.
 * Unauthorized copying, distribution, or use is strictly prohibited.
 * For licensing inquiries, contact: hexQuant@gmail.com
 */

// DOM Selectors for Twitter/X
const SELECTORS = {
  // Tweet elements
  tweetArticle: 'article[data-testid="tweet"]',
  tweetText: '[data-testid="tweetText"]',
  replyButton: '[data-testid="reply"]',
  retweetButton: '[data-testid="retweet"]',
  likeButton: '[data-testid="like"]',
  
  // Reply interface
  replyTextarea: 'div[data-testid="tweetTextarea_0"]',
  tweetButton: '[data-testid="tweetButton"]',
  
  // Tweet metadata
  tweetAuthor: '[data-testid="User-Name"] a',
  tweetTime: 'time',
  tweetLang: '[lang]',
  
  // Media and special content
  tweetPhoto: '[data-testid="tweetPhoto"]',
  tweetVideo: '[data-testid="tweetVideo"]',
  tweetPoll: '[data-testid="poll"]',
  quoteTweet: '[data-testid="quoteTweet"]',
  
  // Thread detection
  threadLine: '[data-testid="tweet"] > div > div > div > div:nth-child(2) > div:nth-child(1) > div > div',
  showThread: 'span:has-text("Show this thread")'
};

// AI Provider Configurations
const AI_PROVIDERS = {
  GEMINI: {
    id: 'gemini',
    name: 'Google Gemini',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.8,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 150,
      stopSequences: [],
      candidateCount: 1
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_NONE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE"
      }
    ]
  },
  
  OPENROUTER: {
    id: 'openrouter',
    name: 'OpenRouter',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'deepseek/deepseek-chat-v3.1:free',
    generationConfig: {
      temperature: 0.8,
      max_tokens: 150,
      top_p: 0.95
    }
  },
  
  OPENAI: {
    id: 'openai',
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-3.5-turbo',
    generationConfig: {
      temperature: 0.8,
      max_tokens: 150,
      top_p: 0.95
    }
  },
  
  DEEPSEEK: {
    id: 'deepseek',
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    defaultModel: 'deepseek-chat',
    generationConfig: {
      temperature: 0.8,
      max_tokens: 150,
      top_p: 0.95
    }
  },
  
  CLAUDE: {
    id: 'claude',
    name: 'Anthropic Claude',
    endpoint: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-3-haiku-20240307',
    generationConfig: {
      temperature: 0.8,
      max_tokens: 150,
      top_p: 0.95
    }
  }
};

// Legacy support - keep existing GEMINI_CONFIG for backward compatibility
const GEMINI_CONFIG = AI_PROVIDERS.GEMINI;

// Extension State
const STATE = {
  isGenerating: false,
  currentTweetId: null,
  lastGenerated: null,
  observers: [],
  injectedButtons: new Set()
};

// Error Messages
const ERROR_MESSAGES = {
  API_KEY_MISSING: 'Please set your Gemini API key in extension settings',
  API_KEY_INVALID: 'Invalid API key. Please check your settings.',
  RATE_LIMIT: 'Too many requests. Please wait a moment.',
  NETWORK_ERROR: 'Connection failed. Check your internet.',
  TWEET_NOT_FOUND: 'Could not read tweet content.',
  RESPONSE_TOO_LONG: 'Generated reply exceeds Twitter limit.',
  GENERATION_FAILED: 'Failed to generate reply. Please try again.'
};

// Button States
const BUTTON_STATES = {
  idle: '✨ Auto Reply',
  loading: '⏳ Generating...',
  error: '❌ Retry',
  success: '✅ Ready'
};

// Default Settings
const DEFAULT_SETTINGS = {
  enabled: true,
  provider: 'gemini',
  geminiKey: '',
  openRouterKey: '',
  openaiKey: '',
  deepseekKey: '',
  claudeKey: '',
  openRouterModel: 'deepseek/deepseek-chat-v3.1:free',
  openRouterCustomModelName: '',
  openaiModel: 'gpt-4o',
  openaiCustomModelName: '',
  deepseekModel: 'deepseek-chat',
  claudeModel: 'claude-opus-4-20250514',
  claudeCustomModelName: '',
  minWords: 5,
  maxWords: 16,
  defaultText: '',
  includeEmoji: true,
  tone: 'casual',
  delayRange: '3-8',
  typingSpeed: 'normal'
};

// Typing Speeds
const TYPING_SPEEDS = {
  slow: { base: 100, variance: 50 },
  normal: { base: 50, variance: 30 },
  fast: { base: 30, variance: 20 }
};

// Tweet Types for Context Analysis
const TWEET_TYPES = {
  NEWS: 'news',
  PERSONAL: 'personal',
  QUESTION: 'question',
  EDUCATIONAL: 'educational',
  HUMOR: 'humor',
  OPINION: 'opinion',
  PROMOTIONAL: 'promotional',
  THREAD: 'thread'
};

// Language Patterns for Detection
const LANGUAGE_PATTERNS = {
  english: /^[a-zA-Z\s\d\p{P}]+$/u,
  spanish: /[ñáéíóúü]/i,
  french: /[àâäéèêëïîôùûüÿç]/i,
  german: /[äöüß]/i,
  italian: /[àèéìíîòóù]/i,
  portuguese: /[ãáàâéêíóôõú]/i,
  russian: /[а-яё]/i,
  arabic: /[\u0600-\u06FF]/,
  chinese: /[\u4e00-\u9fff]/,
  japanese: /[\u3040-\u309f\u30a0-\u30ff]/,
  korean: /[\uac00-\ud7af]/
};

// Character Limits
const LIMITS = {
  TWITTER_CHAR_LIMIT: 280,
  URL_CHAR_COUNT: 23,
  MAX_HASHTAG_LENGTH: 100,
  MAX_WORD_COUNT: 100,
  MIN_WORD_COUNT: 5
};

// CSS Classes
const CSS_CLASSES = {
  autoReplyWrapper: 'auto-reply-wrapper',
  autoReplyBtn: 'auto-reply-btn',
  replyControls: 'reply-controls',
  controlBtn: 'control-btn',
  toastContainer: 'toast-container',
  toast: 'toast',
  typingIndicator: 'typing-indicator'
};

// Animation Durations (ms)
const ANIMATIONS = {
  BUTTON_HOVER: 200,
  TOAST_SLIDE: 300,
  TYPING_BLINK: 1000,
  DEBOUNCE_DELAY: 300
};

// Debug Configuration
const DEBUG = {
  enabled: false,
  prefix: '[X Auto Reply]',
  logLevels: ['info', 'warn', 'error', 'debug']
};
