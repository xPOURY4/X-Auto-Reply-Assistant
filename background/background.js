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

// Background service worker for API calls and message handling

// Define constants locally
const DEFAULT_SETTINGS = {
  enabled: true,
  provider: 'gemini',
  geminiKey: '',
  openRouterKey: '',
  openRouterModel: 'deepseek/deepseek-chat-v3.1:free',
  customModelName: '',
  minWords: 5,
  maxWords: 16,
  defaultText: '',
  includeEmoji: true,
  tone: 'casual',
  delayRange: '3-8',
  typingSpeed: 'normal'
};

const GEMINI_CONFIG = {
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',
  generationConfig: {
    temperature: 0.8,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 150,
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
};

const OPENROUTER_CONFIG = {
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  defaultModel: 'deepseek/deepseek-chat-v3.1:free',
  generationConfig: {
    temperature: 0.8,
    max_tokens: 150,
    top_p: 0.95
  }
};

const TONE_PROMPTS = {
  casual: "Write like a real friend texting: use contractions (you're, don't, can't), sometimes start lowercase, add 1-2 natural emojis, casual abbreviations (ur, thx, bc), relaxed punctuation (..., !!), no corporate speak.",
  professional: "Business-appropriate but human: clear and concise, active voice, no emojis, avoid filler words, maintain professional respect while staying conversational and authentic.",
  humorous: "Naturally funny human: light jokes or wordplay, upbeat energy, maybe one emoji, self-deprecating humor okay, keep it clever and relatable, never forced or offensive.",
  formal: "Proper but human: correct grammar, no contractions, sophisticated vocabulary, neutral tone, no emojis, maintain dignity while being genuine and thoughtful.",
  'pro-plus': "Executive confidence: strong action words, results-focused, no emojis, brief and impactful, confident tone, avoid exclamation marks, sound like a seasoned professional.",
  academic: "Scholarly yet human: precise language, thoughtful analysis, hedging when appropriate (may, suggests), complex ideas simply expressed, no emojis, objective but engaging.",
  troll: "Playful roasting: witty sarcasm, eye-roll emoji 🙄, clever put-downs, challenge ideas not people, stay sharp and funny, never cruel or offensive.",
  bully: "Playful trash-talk: light teasing, absurd comparisons, clown emoji 🤡, poke fun at logic, keep it humorous, never cross into actual bullying or hate.",
  roasting: "Good-natured roasting: countryside humor, folksy metaphors, goat emoji 🐐, mock the idea playfully, stay funny and creative, never personal attacks."
};

const ERROR_MESSAGES = {
  API_KEY_INVALID: 'Invalid API key. Please check your settings.',
  RATE_LIMIT: 'Too many requests. Please wait a moment.',
  GENERATION_FAILED: 'Failed to generate reply. Please try again.'
};

const LIMITS = {
  TWITTER_CHAR_LIMIT: 280,
  URL_CHAR_COUNT: 23,
  API_TIMEOUT: 30000 // 30 seconds timeout for API calls
};

// Service worker persistence
let keepAliveInterval;

// Helper function to add timeout to fetch requests
function fetchWithTimeout(url, options, timeout = LIMITS.API_TIMEOUT) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeout)
    )
  ]);
}

function startKeepAlive() {
  if (keepAliveInterval) return;
  
  keepAliveInterval = setInterval(() => {
    chrome.runtime.getPlatformInfo(() => {
      // Keep service worker alive
    });
  }, 20000); // Every 20 seconds
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
}

// Initialize with enhanced error handling
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('X Auto Reply Extension installed/updated');
  
  try {
    // Start keep-alive mechanism
    startKeepAlive();
    
    // Handle different installation types
    if (details.reason === 'install') {
      // First time installation
      await chrome.storage.local.set({
        settings: DEFAULT_SETTINGS
      });
      
      // Open tutorial page
      try {
        await chrome.tabs.create({ 
          url: 'https://hexquant.xyz/X-Auto-Reply-Assistant/',
          active: true
        });
      } catch (error) {
        console.warn('Failed to open tutorial page:', error);
      }
      
    } else if (details.reason === 'update') {
      // Extension updated - merge with existing settings
      const result = await chrome.storage.local.get(['settings']);
      const existingSettings = result.settings || {};
      const mergedSettings = { ...DEFAULT_SETTINGS, ...existingSettings };
      
      await chrome.storage.local.set({
        settings: mergedSettings
      });
    }
    
  } catch (error) {
    console.error('Installation/update failed:', error);
  }
});

// Handle startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  startKeepAlive();
});

// Handle suspension
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending');
  stopKeepAlive();
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle both old and new message formats
  if (request.action === 'generateReply' || request.type === 'generateReply') {
    handleGenerateReply(request, sendResponse);
    return true; // Keep the message channel open for async response
  } else if (request.action === 'openPopup') {
    chrome.action.openPopup();
  } else if (request.action === 'recordStats') {
    handleRecordStats(request, sendResponse);
    return true;
  } else if (request.action === 'generateTweet' || request.type === 'generateTweet') {
    handleGenerateTweet(request, sendResponse);
    return true;
  }
});

// Generate reply using selected AI provider
async function handleGenerateReply(request, sendResponse) {
  try {
    const { tweetContent } = request;
    
    // Validate request
    if (!tweetContent || !tweetContent.text) {
      throw new Error('Invalid tweet content');
    }
    
    console.log('🚀 [BACKGROUND] Starting reply generation...');
    
    // Fetch fresh settings from storage to ensure provider switching works
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {};
    
    console.log('📋 [BACKGROUND] Loaded settings from storage:', {
      provider: settings?.provider,
      geminiModel: settings?.geminiModel,
      openRouterModel: settings?.openRouterModel,
      openaiModel: settings?.openaiModel,
      deepseekModel: settings?.deepseekModel,
      claudeModel: settings?.claudeModel,
      timestamp: new Date().toISOString()
    });
    
    // Get provider and API key
    const provider = settings?.provider || 'gemini';
    const apiKey = await getApiKeyForProvider(provider, settings);
    
    if (!apiKey) {
      throw new Error(`${getProviderDisplayName(provider)} API key not configured`);
    }
    
    console.log(`🔧 [BACKGROUND] Using provider: ${provider} with model selection`);
    
    // Build the prompt
    const prompt = buildPrompt(tweetContent, settings);
    
    // Call appropriate API
    let reply;
    let selectedModel;
    
    switch (provider) {
      case 'gemini':
        selectedModel = 'gemini-2.0-flash';
        console.log(`🤖 [BACKGROUND] Calling Gemini API with model: ${selectedModel}`);
        reply = await callGeminiAPI(prompt, apiKey);
        break;
      case 'openrouter':
        selectedModel = settings?.openRouterModel === 'custom' ? 
          settings?.openRouterCustomModelName : 
          settings?.openRouterModel;
        console.log(`🤖 [BACKGROUND] Calling OpenRouter API with model: ${selectedModel}`);
        reply = await callOpenRouterAPI(prompt, apiKey, selectedModel);
        break;
      case 'openai':
        selectedModel = settings?.openaiModel === 'custom' ? 
          settings?.openaiCustomModelName : 
          (settings?.openaiModel || 'gpt-4o');
        console.log(`🤖 [BACKGROUND] Calling OpenAI API with model: ${selectedModel}`);
        reply = await callOpenAIAPI(prompt, apiKey, selectedModel);
        break;
      case 'deepseek':
        selectedModel = settings?.deepseekModel || 'deepseek-chat';
        console.log(`🤖 [BACKGROUND] Calling DeepSeek API with model: ${selectedModel}`);
        reply = await callDeepSeekAPI(prompt, apiKey, selectedModel);
        break;
      case 'claude':
        selectedModel = settings?.claudeModel === 'custom' ? 
          settings?.claudeCustomModelName : 
          (settings?.claudeModel || 'claude-opus-4-20250514');
        console.log(`🤖 [BACKGROUND] Calling Claude API with model: ${selectedModel}`);
        reply = await callClaudeAPI(prompt, apiKey, selectedModel);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    console.log(`✅ [BACKGROUND] Successfully generated reply using ${provider}/${selectedModel}`);
    
    // Validate and process reply
    const processedReply = validateAndProcessReply(reply, settings);
    
    sendResponse({ success: true, reply: processedReply });
  } catch (error) {
    console.error('❌ [BACKGROUND] Generate reply error:', error);
    sendResponse({ 
      success: false, 
      error: error.message || ERROR_MESSAGES.GENERATION_FAILED
    });
  }
}

// Helper function to get API key for provider
async function getApiKeyForProvider(provider, settings) {
  switch (provider) {
    case 'gemini':
      return settings?.geminiKey;
    case 'openrouter':
      return settings?.openRouterKey;
    case 'openai':
      return settings?.openaiKey;
    case 'deepseek':
      return settings?.deepseekKey;
    case 'claude':
      return settings?.claudeKey;
    default:
      return null;
  }
}

// Helper function to get provider display name
function getProviderDisplayName(provider) {
  const names = {
    'gemini': 'Gemini',
    'openrouter': 'OpenRouter',
    'openai': 'OpenAI',
    'deepseek': 'DeepSeek',
    'claude': 'Claude'
  };
  return names[provider] || provider;
}

// Handle usage statistics recording
async function handleRecordStats(request, sendResponse) {
  try {
    const { statsAction, data } = request;
    
    // Record the stats
    console.log('Stats recorded:', statsAction, data);
    
    sendResponse({ success: true });
  } catch (error) {
    console.error('Failed to record stats:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// Handle tweet generation
async function handleGenerateTweet(request, sendResponse) {
  try {
    const { prompt } = request;
    
    console.log('🚀 [BACKGROUND] Starting tweet generation...');
    
    // Fetch fresh settings from storage to ensure provider switching works
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {};
    
    console.log('📋 [BACKGROUND] Loaded settings for tweet generation:', {
      provider: settings?.provider,
      geminiModel: settings?.geminiModel,
      openRouterModel: settings?.openRouterModel,
      openaiModel: settings?.openaiModel,
      deepseekModel: settings?.deepseekModel,
      claudeModel: settings?.claudeModel,
      timestamp: new Date().toISOString()
    });
    
    // Get provider and API key
    const provider = settings?.provider || 'gemini';
    const apiKey = await getApiKeyForProvider(provider, settings);
    
    if (!apiKey) {
      throw new Error(`${getProviderDisplayName(provider)} API key not configured`);
    }
    
    console.log(`🔧 [BACKGROUND] Tweet generation using provider: ${provider}`);
    
    // Call appropriate API
    let tweet;
    let selectedModel;
    
    switch (provider) {
      case 'gemini':
        selectedModel = 'gemini-2.0-flash';
        console.log(`🤖 [BACKGROUND] Calling Gemini API for tweet with model: ${selectedModel}`);
        tweet = await callGeminiAPI(prompt, apiKey);
        break;
      case 'openrouter':
        selectedModel = settings?.openRouterModel === 'custom' ? 
          settings?.openRouterCustomModelName : 
          settings?.openRouterModel;
        console.log(`🤖 [BACKGROUND] Calling OpenRouter API for tweet with model: ${selectedModel}`);
        tweet = await callOpenRouterAPI(prompt, apiKey, selectedModel);
        break;
      case 'openai':
        selectedModel = settings?.openaiModel === 'custom' ? 
          settings?.openaiCustomModelName : 
          (settings?.openaiModel || 'gpt-4o');
        console.log(`🤖 [BACKGROUND] Calling OpenAI API for tweet with model: ${selectedModel}`);
        tweet = await callOpenAIAPI(prompt, apiKey, selectedModel);
        break;
      case 'deepseek':
        selectedModel = settings?.deepseekModel || 'deepseek-chat';
        console.log(`🤖 [BACKGROUND] Calling DeepSeek API for tweet with model: ${selectedModel}`);
        tweet = await callDeepSeekAPI(prompt, apiKey, selectedModel);
        break;
      case 'claude':
        selectedModel = settings?.claudeModel === 'custom' ? 
          settings?.claudeCustomModelName : 
          (settings?.claudeModel || 'claude-opus-4-20250514');
        console.log(`🤖 [BACKGROUND] Calling Claude API for tweet with model: ${selectedModel}`);
        tweet = await callClaudeAPI(prompt, apiKey, selectedModel);
        break;
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    console.log(`✅ [BACKGROUND] Successfully generated tweet using ${provider}/${selectedModel}`);
    
    // Validate and process tweet
    const processedTweet = validateAndProcessReply(tweet, settings);
    
    sendResponse({ success: true, tweet: processedTweet });
  } catch (error) {
    console.error('❌ [BACKGROUND] Tweet generation error:', error);
    sendResponse({ 
      success: false, 
      error: error.message || ERROR_MESSAGES.GENERATION_FAILED
    });
  }
}

// Build the prompt for Gemini with enhanced context
function buildPrompt(tweetContent, settings) {
  const wordRange = `${settings.minWords || 5} to ${settings.maxWords || 16}`;
  const language = tweetContent.language || 'en';
  const tweetType = tweetContent.type || 'personal';
  
  const prompt = `You are a real Twitter user responding naturally to tweets. 

ORIGINAL TWEET:
"${tweetContent.text}"

CONTEXT:
- Author: ${tweetContent.author || 'Unknown'}
- Language: ${language}
- Type: ${tweetType}

REQUIREMENTS:
1. Reply in the same language as the tweet
2. Length: ${wordRange} words (vary randomly within this range)
3. Tone: Match the tweet's emotional tone and formality level
4. Human writing patterns:
   - Sometimes start with lowercase (30% chance)
   - Natural punctuation variations (... or !! or ??)
   - Common abbreviations when appropriate (ur, ppl, thx, bc)
   - Contractions (you're, don't, can't, won't)
${settings.includeEmoji ? '5. Include 1-2 contextually relevant emojis naturally placed' : '5. NO emojis'}

CRITICAL RULES:
- Write as a regular human Twitter user, not an AI
- Be conversational and engaging
- Never reveal you're AI or use formal/robotic language
- Keep response focused and relevant to the tweet
- Use natural, conversational language
- Match the energy level of the original tweet
- Be authentic and relatable

Generate ONLY the reply text. No explanations, metadata, or quotation marks.

TONE INSTRUCTION: ${TONE_PROMPTS[settings.tone] || TONE_PROMPTS.casual}`;

  return prompt;
}

// Call Gemini API with retry logic and proper error handling
async function callGeminiAPI(prompt, apiKey, retryCount = 0) {
  const maxRetries = 3;
  const backoffDelay = Math.pow(2, retryCount) * 1000; // Exponential backoff
  
  try {
    const response = await fetchWithTimeout(`${GEMINI_CONFIG.endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: GEMINI_CONFIG.generationConfig,
        safetySettings: GEMINI_CONFIG.safetySettings
      })
    });
    
    if (!response.ok) {
      await handleApiError(response, retryCount, maxRetries);
    }
    
    const data = await response.json();
    
    // Validate response structure
    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error('Invalid response structure from Gemini API');
    }
    
    const reply = data.candidates[0].content.parts[0].text.trim();
    
    if (!reply) {
      throw new Error('Empty reply from Gemini API');
    }
    
    return reply;
    
  } catch (error) {
    if (retryCount < maxRetries && !isNonRetryableError(error)) {
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      throw new Error('Maximum retries exceeded');
    }
    
    throw error;
  }
}

// Call OpenRouter API with retry logic
async function callOpenRouterAPI(prompt, apiKey, model, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 1000;
  const selectedModel = model || OPENROUTER_CONFIG.defaultModel;
  
  try {
    const response = await fetchWithTimeout(OPENROUTER_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://x.com',
        'X-Title': 'X Auto Reply Assistant'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [{
          role: 'user',
          content: prompt
        }],
        ...OPENROUTER_CONFIG.generationConfig
      })
    });
    
    if (!response.ok) {
       await handleApiError(response, retryCount, maxRetries);
       
       // If we get here, it means we should retry
       const delay = baseDelay * Math.pow(2, retryCount);
       await new Promise(resolve => setTimeout(resolve, delay));
       return callOpenRouterAPI(prompt, apiKey, model, retryCount + 1);
     }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter API');
    }
    
    return data.choices[0].message.content;
    
  } catch (error) {
    if (retryCount < maxRetries && !isNonRetryableError(error)) {
      const delay = baseDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callOpenRouterAPI(prompt, apiKey, model, retryCount + 1);
    }
    throw error;
  }
}

// Call OpenAI API
async function callOpenAIAPI(prompt, apiKey, model, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  try {
    const response = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.8,
        max_tokens: 150,
        top_p: 0.95
      })
    });
    
    if (!response.ok) {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callOpenAIAPI(prompt, apiKey, model, retryCount + 1);
      }
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenAI API');
    }
    
    return data.choices[0].message.content;
    
  } catch (error) {
    if (retryCount < maxRetries && !isNonRetryableError(error)) {
      const delay = baseDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callOpenAIAPI(prompt, apiKey, model, retryCount + 1);
    }
    throw error;
  }
}

// Call DeepSeek API
async function callDeepSeekAPI(prompt, apiKey, model, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  try {
    const response = await fetchWithTimeout('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'deepseek-chat',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.8,
        max_tokens: 150,
        top_p: 0.95
      })
    });
    
    if (!response.ok) {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callDeepSeekAPI(prompt, apiKey, model, retryCount + 1);
      }
      throw new Error(`DeepSeek API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from DeepSeek API');
    }
    
    return data.choices[0].message.content;
    
  } catch (error) {
    if (retryCount < maxRetries && !isNonRetryableError(error)) {
      const delay = baseDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callDeepSeekAPI(prompt, apiKey, model, retryCount + 1);
    }
    throw error;
  }
}

// Call Claude API
async function callClaudeAPI(prompt, apiKey, model, retryCount = 0) {
  const maxRetries = 3;
  const baseDelay = 1000;
  
  try {
    const response = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 150,
        temperature: 0.8
      })
    });
    
    if (!response.ok) {
      if (retryCount < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        return callClaudeAPI(prompt, apiKey, model, retryCount + 1);
      }
      throw new Error(`Claude API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response format from Claude API');
    }
    
    return data.content[0].text;
    
  } catch (error) {
    if (retryCount < maxRetries && !isNonRetryableError(error)) {
      const delay = baseDelay * Math.pow(2, retryCount);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callClaudeAPI(prompt, apiKey, model, retryCount + 1);
    }
    throw error;
  }
}

// Handle API errors with appropriate messages
async function handleApiError(response, retryCount, maxRetries) {
  const status = response.status;
  
  if (status === 429) {
    // Rate limit - retry with exponential backoff
    if (retryCount < maxRetries) {
      const retryAfter = response.headers.get('Retry-After');
      const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGeminiAPI(prompt, apiKey, retryCount + 1);
    }
    throw new Error(ERROR_MESSAGES.RATE_LIMIT);
  } else if (status === 403) {
    throw new Error(ERROR_MESSAGES.API_KEY_INVALID);
  } else if (status === 400) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Bad request to Gemini API');
  } else if (status >= 500) {
    // Server error - retry
    if (retryCount < maxRetries) {
      throw new Error('Temporary server error'); // Will be caught and retried
    }
    throw new Error('Gemini API server error. Please try again later.');
  } else {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `API request failed (${status})`);
  }
}

// Check if error should not be retried
function isNonRetryableError(error) {
  const nonRetryableErrors = [
    'Invalid API key',
    'API key not configured',
    'Invalid response structure',
    'Empty reply'
  ];
  
  return nonRetryableErrors.some(errorMsg => 
    error.message.includes(errorMsg)
  );
}

// Validate and process the generated reply
function validateAndProcessReply(reply, settings) {
  let processedReply = reply.trim();
  
  // Remove any AI-like metadata or explanations
  const unwantedPatterns = [
    /^(Here's|Here is) (a|an|the) (reply|response|tweet):\s*/gi,
    /^(Reply|Response|Tweet):\s*/gi,
    /^I (would|will|can) (say|reply|respond):\s*/gi,
    /^(As an AI|As a language model|I'm an AI).*$/gim,
    /\n.*explanation.*$/gim,
    /\n.*note.*$/gim
  ];
  
  unwantedPatterns.forEach(pattern => {
    processedReply = processedReply.replace(pattern, '');
  });
  
  // Clean up any remaining quotes
  processedReply = processedReply.trim();
  if ((processedReply.startsWith('"') && processedReply.endsWith('"')) ||
      (processedReply.startsWith("'") && processedReply.endsWith("'"))) {
    processedReply = processedReply.slice(1, -1).trim();
  }
  
  // Add human-like variations
  processedReply = addHumanVariations(processedReply);
  
  // Add default text if configured (with proper spacing)
  if (settings.defaultText && settings.defaultText.trim()) {
    const defaultText = settings.defaultText.trim();
    // Check if we need a space before default text
    const needsSpace = !processedReply.endsWith(' ') && 
                      !defaultText.startsWith(' ') && 
                      !defaultText.startsWith('#') && 
                      !defaultText.startsWith('@');
    
    processedReply += (needsSpace ? ' ' : '') + defaultText;
  }
  
  // Final cleanup - remove multiple spaces
  processedReply = processedReply.replace(/\s+/g, ' ').trim();
  
  // Ensure Twitter character limit
  processedReply = enforceCharacterLimit(processedReply);
  
  return processedReply;
}

// Add human-like variations to the reply
function addHumanVariations(reply) {
  let processed = reply.trim();
  
  // Remove any AI-like prefixes or suffixes
  const aiPrefixes = [
    'Here\'s a reply:', 'Here is a reply:', 'Reply:', 'Response:',
    'I would say:', 'I think:', 'My response would be:', 'Here\'s what I\'d say:',
    'As an AI', 'As a language model', 'I\'m an AI'
  ];
  
  for (const prefix of aiPrefixes) {
    const regex = new RegExp(`^${prefix}\\s*`, 'gi');
    processed = processed.replace(regex, '');
  }
  
  // Remove quotes if AI wrapped the response
  if ((processed.startsWith('"') && processed.endsWith('"')) ||
      (processed.startsWith("'") && processed.endsWith("'"))) {
    processed = processed.slice(1, -1);
  }
  
  // Randomly lowercase the first letter (25% chance)
  if (Math.random() < 0.25 && processed.length > 0 && /[A-Z]/.test(processed.charAt(0))) {
    processed = processed.charAt(0).toLowerCase() + processed.slice(1);
  }
  
  // Replace formal words with casual ones (randomly)
  const replacements = {
    'you are': Math.random() < 0.4 ? 'ur' : 'you are',
    'people': Math.random() < 0.3 ? 'ppl' : 'people',
    'thank you': Math.random() < 0.5 ? 'thx' : 'thank you',
    'thanks': Math.random() < 0.4 ? 'thx' : 'thanks',
    'because': Math.random() < 0.3 ? 'bc' : 'because',
    'with': Math.random() < 0.15 ? 'w/' : 'with',
    'without': Math.random() < 0.15 ? 'w/o' : 'without',
    'okay': Math.random() < 0.4 ? 'ok' : 'okay',
    'about': Math.random() < 0.2 ? 'bout' : 'about',
    'something': Math.random() < 0.2 ? 'smth' : 'something',
    'someone': Math.random() < 0.2 ? 'sb' : 'someone',
    'before': Math.random() < 0.15 ? 'b4' : 'before',
    'for': Math.random() < 0.1 ? '4' : 'for',
    'to': Math.random() < 0.05 ? '2' : 'to',
    'too': Math.random() < 0.05 ? '2' : 'too'
  };
  
  for (const [formal, casual] of Object.entries(replacements)) {
    if (typeof casual === 'string') {
      // Use word boundaries to avoid partial matches
      const regex = new RegExp(`\\b${formal}\\b`, 'gi');
      processed = processed.replace(regex, casual);
    }
  }
  
  // Add natural punctuation variations (10% chance)
  if (Math.random() < 0.1) {
    // Replace single ! with !! (30% chance)
    if (Math.random() < 0.3) {
      processed = processed.replace(/!(?!!)/g, '!!');
    }
    // Replace single ? with ?? (20% chance)
    if (Math.random() < 0.2) {
      processed = processed.replace(/\?(?!\?)/g, '??');
    }
    // Add ... at the end sometimes (15% chance)
    if (Math.random() < 0.15 && !processed.endsWith('...') && !processed.endsWith('.')) {
      processed = processed.replace(/[.!?]$/, '...');
    }
  }
  
  return processed;
}

// Enforce Twitter character limit
function enforceCharacterLimit(text) {
  const limit = LIMITS.TWITTER_CHAR_LIMIT;
  
  if (getTwitterCharCount(text) <= limit) {
    return text;
  }
  
  // Trim by words to maintain readability
  const words = text.split(/\s+/);
  let trimmed = '';
  
  for (const word of words) {
    const testText = trimmed ? `${trimmed} ${word}` : word;
    if (getTwitterCharCount(testText) > limit - 3) { // Leave room for "..."
      break;
    }
    trimmed = testText;
  }
  
  // Add ellipsis if we had to trim
  if (trimmed !== text) {
    trimmed += '...';
  }
  
  return trimmed;
}

// Calculate Twitter character count (URLs count as 23 chars)
function getTwitterCharCount(text) {
  // URLs count as 23 characters
  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls = text.match(urlRegex) || [];
  
  let charCount = text.length;
  
  // Adjust for URLs
  urls.forEach(url => {
    charCount = charCount - url.length + LIMITS.URL_CHAR_COUNT;
  });
  
  return charCount;
}

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.action.openPopup();
});

// Context menu for quick actions (optional)
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'openSettings',
    title: 'X Auto Reply Settings',
    contexts: ['action']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'openSettings') {
    chrome.action.openPopup();
  }
});

// Clean up old data periodically
chrome.alarms.create('cleanup', { periodInMinutes: 60 * 24 }); // Daily

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupOldData();
  }
});

// Clean up old usage statistics and cache
async function cleanupOldData() {
  try {
    // Clean up old usage stats (keep last 30 days)
    const result = await chrome.storage.local.get(['usageStats']);
    if (result.usageStats) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 30);
      const cutoffString = cutoffDate.toISOString().split('T')[0];
      
      const cleanedStats = {};
      for (const [date, stats] of Object.entries(result.usageStats)) {
        if (date >= cutoffString) {
          cleanedStats[date] = stats;
        }
      }
      
      await chrome.storage.local.set({ usageStats: cleanedStats });
    }
    
    // Clean up old debug logs (keep last 100 entries)
    const debugResult = await chrome.storage.local.get(['debugLogs']);
    if (debugResult.debugLogs && debugResult.debugLogs.length > 100) {
      const cleanedLogs = debugResult.debugLogs.slice(-100);
      await chrome.storage.local.set({ debugLogs: cleanedLogs });
    }
    
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}