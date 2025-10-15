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

// Content script for X Auto Reply Assistant
(function() {
    'use strict';
    
    // Check if extension context is valid
    function isExtensionContextValid() {
        try {
            return chrome.runtime && chrome.runtime.id;
        } catch (error) {
            return false;
        }
    }
    
    // Safe Chrome API call wrapper
    async function safeRuntimeSendMessage(message) {
        try {
            if (!isExtensionContextValid()) {
                throw new Error('Extension context invalidated. Please reload the page.');
            }
            return await chrome.runtime.sendMessage(message);
        } catch (error) {
            if (error.message.includes('Extension context invalidated') || 
                error.message.includes('receiving end does not exist')) {
                throw new Error('Extension was reloaded. Please refresh the page and try again.');
            }
            throw error;
        }
    }
    
    // Define constants locally to avoid dependency issues
    const SELECTORS = {
        tweetArticle: 'article[data-testid="tweet"]',
        tweetText: '[data-testid="tweetText"]',
        replyButton: '[data-testid="reply"], [aria-label*="Reply"], [aria-label*="reply"], button[data-testid="reply"]',
        retweetButton: '[data-testid="retweet"]',
        likeButton: '[data-testid="like"]',
        replyTextarea: '[data-testid="tweetTextarea_0"]',
        replyTextareaAlt: 'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
        replyTextareaAlt2: '[role="textbox"][data-testid="tweetTextarea_0"]',
        tweetButton: '[data-testid="tweetButton"]'
    };

    const CSS_CLASSES = {
        autoReplyWrapper: 'auto-reply-wrapper',
        autoReplyBtn: 'auto-reply-btn',
        replyControls: 'reply-controls',
        controlBtn: 'control-btn',
        toastContainer: 'toast-container',
        toast: 'toast'
    };

    const BUTTON_STATES = {
        idle: '✨ Auto Reply',
        loading: '⏳ Generating...',
        error: '❌ Retry',
        success: '✅ Ready'
    };

    const ERROR_MESSAGES = {
        API_KEY_MISSING: 'Please set your API key in extension settings',
        TWEET_NOT_FOUND: 'Could not read tweet content.',
        GENERATION_FAILED: 'Failed to generate reply. Please try again.',
        TEXTAREA_NOT_FOUND: 'Reply textarea not found. Please try again.',
        CONTEXT_INVALIDATED: 'Extension was updated. Please refresh the page and try again.'
    };

    const TYPING_SPEEDS = {
        slow: { base: 100, variance: 50 },
        normal: { base: 50, variance: 30 },
        fast: { base: 30, variance: 20 }
    };

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

    // Extension state with enhanced cleanup tracking
    const STATE = {
        isGenerating: false,
        observers: [],
        injectedButtons: new Set(),
        eventListeners: new Map(),
        timers: new Set(),
        isCleanedUp: false
    };
    
    // Helper function to get API key for provider
    function getApiKeyForProvider(provider, settings) {
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
    
    let settings = {};
    
    // Initialize
    async function init() {
        try {
            // Check if extension context is valid
            if (!isExtensionContextValid()) {
                console.warn('Extension context not available. Page may need refresh.');
                return;
            }
            
            // Load settings
            await loadSettings();
            
            // Setup mutation observer
            setupObserver();
            
            // Process existing tweets with delay to ensure DOM is ready
            setTimeout(() => {
                processExistingTweets();
            }, 1000);
            
            // Additional processing after longer delay
            setTimeout(() => {
                console.log('[X Auto Reply] Secondary processing...');
                processExistingTweets();
            }, 3000);
            
            // Listen for messages with error handling
            if (chrome.runtime && chrome.runtime.onMessage) {
                chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                    try {
                        handleMessage(request, sender, sendResponse);
                    } catch (error) {
                        console.log('[X Auto Reply] Error handling message:', error);
                    }
                });
            }
            
            console.log('[X Auto Reply] Extension initialized');
        } catch (error) {
            console.error('Failed to initialize X Auto Reply:', error);
        }
    }
    
    // Load settings from storage
    async function loadSettings() {
        try {
            console.log('📖 [CONTENT] Loading settings from chrome.storage.local...');
            
            if (chrome.storage && chrome.storage.local) {
                const result = await chrome.storage.local.get(['settings']);
                
                if (result.settings) {
                    console.log('📋 [CONTENT] Loaded settings from storage:', result.settings);
                    settings = result.settings;
                    console.log('🔄 [CONTENT] Using loaded settings:', {
                        provider: settings.provider,
                        geminiModel: settings.geminiModel,
                        openRouterModel: settings.openRouterModel,
                        openaiModel: settings.openaiModel,
                        deepseekModel: settings.deepseekModel,
                        claudeModel: settings.claudeModel,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    console.log('⚠️ [CONTENT] No settings found in storage, using defaults');
                    settings = {
                        enabled: true,
                        provider: 'gemini',
                        geminiKey: '',
                        openRouterKey: '',
                        openRouterModel: 'deepseek/deepseek-chat-v3.1:free',
                        minWords: 5,
                        maxWords: 16,
                        defaultText: '',
                        includeEmoji: true,
                        tone: 'casual',
                        delayRange: '3-8',
                        typingSpeed: 'normal'
                    };
                }
            }
        } catch (error) {
            console.error('❌ [CONTENT] Failed to load settings:', error);
        }
    }
    
    // Setup MutationObserver for dynamic content with proper cleanup
    function setupObserver() {
        if (STATE.isCleanedUp) return;
        
        let debounceTimer;
        
        const observer = new MutationObserver((mutations) => {
            if (STATE.isCleanedUp) return;
            
            if (debounceTimer) {
                clearTimeout(debounceTimer);
                STATE.timers.delete(debounceTimer);
            }
            
            debounceTimer = addTrackedTimer(() => {
                if (!STATE.isCleanedUp) {
                    processNewTweets();
                    checkForComposer();
                }
            }, 300);
        });
        
        try {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            STATE.observers.push(observer);
        } catch (error) {
            console.error('Failed to setup observer:', error);
        }
    }
    
    // Process existing tweets on page load
    function processExistingTweets() {
        const replyButtons = document.querySelectorAll(SELECTORS.replyButton);
        console.log(`[X Auto Reply] Processing ${replyButtons.length} existing reply buttons`);
        replyButtons.forEach((button, index) => {
            console.log(`[X Auto Reply] Processing reply button ${index + 1}/${replyButtons.length}`);
            injectAutoReplyButton(button);
        });
    }
    
    // Process newly loaded tweets
    function processNewTweets() {
        const replyButtons = document.querySelectorAll(SELECTORS.replyButton);
        replyButtons.forEach(button => {
            if (!button.dataset.autoReplyInjected) {
                injectAutoReplyButton(button);
            }
        });
    }
    
    // Inject Auto Reply button
    function injectAutoReplyButton(replyButton) {
        try {
            // Check if extension context is still valid
            if (!isExtensionContextValid()) {
                console.log('[X Auto Reply] Extension context invalid, skipping injection');
                return;
            }
            
            // Check if already injected
            if (replyButton.dataset.autoReplyInjected) {
                console.log('[X Auto Reply] Button already injected for this reply button');
                return;
            }
            
            // Mark as injected
            replyButton.dataset.autoReplyInjected = 'true';
            
            // Find the action buttons container
            const container = replyButton.closest('[role="group"]') || replyButton.parentElement;
            if (!container) {
                console.log('[X Auto Reply] No container found for reply button');
                return;
            }
            
            // Check if button already exists in this container
            if (container.querySelector(`.${CSS_CLASSES.autoReplyBtn}`)) {
                console.log('[X Auto Reply] Auto Reply button already exists in container');
                return;
            }
            
            console.log('[X Auto Reply] Injecting Auto Reply button...');
            
            // Create auto reply button
            const autoReplyBtn = document.createElement('button');
            autoReplyBtn.className = CSS_CLASSES.autoReplyBtn;
            autoReplyBtn.innerHTML = BUTTON_STATES.idle;
            autoReplyBtn.style.cssText = `
                margin-left: 8px;
                padding: 6px 12px;
                border-radius: 9999px;
                border: 1px solid rgb(29, 155, 240);
                background-color: transparent;
                color: rgb(29, 155, 240);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
            `;
            
            // Add hover effects
            autoReplyBtn.onmouseenter = () => {
                autoReplyBtn.style.backgroundColor = 'rgba(29, 155, 240, 0.1)';
            };
            autoReplyBtn.onmouseleave = () => {
                autoReplyBtn.style.backgroundColor = 'transparent';
            };
            
            // Add click handler
            autoReplyBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleAutoReplyClick(e, replyButton);
            });
            
            // Insert button
            container.appendChild(autoReplyBtn);
            
            // Track injected button
            STATE.injectedButtons.add(autoReplyBtn);
            
            console.log('[X Auto Reply] Auto Reply button successfully injected!');
            
        } catch (error) {
            console.error('Error injecting auto reply button:', error);
        }
    }
    
    // Handle auto reply button click
    async function handleAutoReplyClick(event, replyButton) {
        const button = event.target;
        
        try {
            // Check if already generating
            if (STATE.isGenerating) {
                showToast('Already generating a reply. Please wait...', 'warning');
                return;
            }
            
            // Check API key based on provider
            const provider = settings.provider || 'gemini';
            const apiKey = getApiKeyForProvider(provider, settings);
            
            if (!apiKey) {
                const providerName = getProviderDisplayName(provider);
                showToast(`Please set your ${providerName} API key in extension settings`, 'error');
                return;
            }
            
            STATE.isGenerating = true;
            updateButtonState(button, 'loading');
            
            // First click the reply button to open reply interface
            replyButton.click();
            
            // Wait for reply interface to load
            await sleep(1000);
            
            // Extract tweet content
            const tweetContent = extractTweetContent(replyButton);
            if (!tweetContent) {
                throw new Error(ERROR_MESSAGES.TWEET_NOT_FOUND);
            }
            
            // Fetch fresh settings to ensure provider switching works
            await loadSettings();
            
            // Generate reply
            showToast('Generating your reply...', 'info');
            
            const response = await safeRuntimeSendMessage({
                type: 'generateReply',
                tweetContent: tweetContent,
                settings: settings
            });
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const replyText = response.reply;
            if (!replyText) {
                throw new Error(ERROR_MESSAGES.GENERATION_FAILED);
            }
            
            // Wait a bit more for interface to be ready
            await sleep(500);
            
            // Insert the reply using improved method
            await insertReplyWithImprovedMethod(replyText);
            
            updateButtonState(button, 'success');
            showToast('Reply generated successfully!', 'success');
            
            // Reset button after delay
            setTimeout(() => {
                updateButtonState(button, 'idle');
            }, 2000);
            
        } catch (error) {
            console.error('Error generating reply:', error);
            updateButtonState(button, 'error');
            showToast(error.message || ERROR_MESSAGES.GENERATION_FAILED, 'error');
            
            // Reset button after delay
            setTimeout(() => {
                updateButtonState(button, 'idle');
            }, 3000);
            
        } finally {
            STATE.isGenerating = false;
        }
    }
    
    // Extract tweet content
    function extractTweetContent(replyButton) {
        const article = replyButton.closest(SELECTORS.tweetArticle);
        if (!article) return null;
        
        const tweetTextElement = article.querySelector(SELECTORS.tweetText);
        if (!tweetTextElement) return null;
        
        // Extract text nodes recursively to get clean text
        function getTextNodes(element) {
            let textNodes = [];
            for (let node = element.firstChild; node; node = node.nextSibling) {
                if (node.nodeType === Node.TEXT_NODE) {
                    textNodes.push(node);
                } else {
                    textNodes = textNodes.concat(getTextNodes(node));
                }
            }
            return textNodes;
        }
        
        const textNodes = getTextNodes(tweetTextElement);
        const text = textNodes.map(node => node.data).join(' ').trim();
        
        // Return object format expected by background script
        return {
            text: text,
            author: extractAuthorInfo(article),
            language: detectLanguage(text),
            type: detectTweetType(text),
            hasMedia: article.querySelector('img, video') !== null,
            isThread: article.querySelector('[data-testid="tweet"] [data-testid="tweet"]') !== null,
            isReply: article.querySelector('[data-testid="reply-link"]') !== null,
            isVerified: article.querySelector('[data-testid="icon-verified"]') !== null,
            mentions: extractMentions(text),
            hashtags: extractHashtags(text),
            engagement: extractEngagement(article),
            timestamp: extractTimestamp(article)
        };
    }
    
    // Helper function to extract author information
    function extractAuthorInfo(article) {
        try {
            const authorElement = article.querySelector('[data-testid="User-Name"] span');
            return authorElement ? authorElement.textContent.trim() : 'Unknown';
        } catch (error) {
            return 'Unknown';
        }
    }
    
    // Helper function to detect language (simple detection)
    function detectLanguage(text) {
        // Simple language detection based on common patterns
        const persianPattern = /[\u0600-\u06FF]/;
        const arabicPattern = /[\u0627-\u064A]/;
        const chinesePattern = /[\u4e00-\u9fff]/;
        const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF]/;
        
        if (persianPattern.test(text)) return 'fa';
        if (arabicPattern.test(text)) return 'ar';
        if (chinesePattern.test(text)) return 'zh';
        if (japanesePattern.test(text)) return 'ja';
        
        return 'en'; // Default to English
    }
    
    // Helper function to detect tweet type
    function detectTweetType(text) {
        const lowerText = text.toLowerCase();
        
        if (lowerText.includes('?')) return TWEET_TYPES.QUESTION;
        if (lowerText.includes('news') || lowerText.includes('breaking')) return TWEET_TYPES.NEWS;
        if (lowerText.includes('learn') || lowerText.includes('tip')) return TWEET_TYPES.EDUCATIONAL;
        if (lowerText.includes('😂') || lowerText.includes('lol') || lowerText.includes('funny')) return TWEET_TYPES.HUMOR;
        if (lowerText.includes('buy') || lowerText.includes('sale') || lowerText.includes('discount')) return TWEET_TYPES.PROMOTIONAL;
        if (lowerText.includes('1/') || lowerText.includes('thread')) return TWEET_TYPES.THREAD;
        if (lowerText.includes('think') || lowerText.includes('believe')) return TWEET_TYPES.OPINION;
        
        return TWEET_TYPES.PERSONAL;
    }
    
    // Helper function to extract mentions
    function extractMentions(text) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }
        return mentions;
    }
    
    // Helper function to extract hashtags
    function extractHashtags(text) {
        const hashtagRegex = /#(\w+)/g;
        const hashtags = [];
        let match;
        while ((match = hashtagRegex.exec(text)) !== null) {
            hashtags.push(match[1]);
        }
        return hashtags;
    }
    
    // Helper function to extract engagement metrics
    function extractEngagement(article) {
        try {
            const engagement = {};
            
            // Extract reply count
            const replyElement = article.querySelector('[data-testid="reply"] span');
            engagement.replies = replyElement ? parseInt(replyElement.textContent) || 0 : 0;
            
            // Extract retweet count
            const retweetElement = article.querySelector('[data-testid="retweet"] span');
            engagement.retweets = retweetElement ? parseInt(retweetElement.textContent) || 0 : 0;
            
            // Extract like count
            const likeElement = article.querySelector('[data-testid="like"] span');
            engagement.likes = likeElement ? parseInt(likeElement.textContent) || 0 : 0;
            
            return engagement;
        } catch (error) {
            return { replies: 0, retweets: 0, likes: 0 };
        }
    }
    
    // Helper function to extract timestamp
    function extractTimestamp(article) {
        try {
            const timeElement = article.querySelector('time');
            return timeElement ? timeElement.getAttribute('datetime') : null;
        } catch (error) {
            return null;
        }
    }
    
    // Enhanced reply textarea detection with comprehensive selectors
    function findReplyTextarea() {
        const selectors = [
            // Primary selectors for Twitter's current structure
            '[data-testid="tweetTextarea_0"]',
            'div[contenteditable="true"][data-testid="tweetTextarea_0"]',
            '[role="textbox"][data-testid="tweetTextarea_0"]',
            
            // Alternative selectors for different contexts
            '[contenteditable="true"][role="textbox"]',
            '.public-DraftEditor-content[contenteditable="true"]',
            '.notranslate[contenteditable="true"]',
            
            // Fallback selectors
            'div[contenteditable="true"][aria-label*="Tweet"]',
            'div[contenteditable="true"][aria-label*="reply"]',
            'div[contenteditable="true"][placeholder*="Tweet"]',
            'div[contenteditable="true"][placeholder*="reply"]',
            
            // Legacy selectors
            'textarea[placeholder*="Tweet"]',
            'textarea[placeholder*="reply"]'
        ];
        
        // First, try to find the most specific and visible element
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (isElementVisible(element) && isElementInteractable(element)) {
                    console.log(`[X Auto Reply] Found textarea with selector: ${selector}`);
                    return element;
                }
            }
        }
        
        // If no element found, try a more aggressive search
        console.warn('[X Auto Reply] Primary selectors failed, trying aggressive search');
        return findTextareaAggressive();
    }
    
    // Aggressive textarea search for edge cases
    function findTextareaAggressive() {
        // Look for any contenteditable element that might be the composer
        const contentEditables = document.querySelectorAll('[contenteditable="true"]');
        
        for (const element of contentEditables) {
            if (isElementVisible(element) && isElementInteractable(element)) {
                // Check if it's likely a tweet composer
                const rect = element.getBoundingClientRect();
                const hasReasonableSize = rect.width > 200 && rect.height > 30;
                const isInComposerArea = element.closest('[data-testid="toolBar"]') || 
                                       element.closest('[data-testid="tweetButton"]') ||
                                       element.closest('form');
                
                if (hasReasonableSize && (isInComposerArea || element.getAttribute('aria-label'))) {
                    console.log('[X Auto Reply] Found textarea via aggressive search');
                    return element;
                }
            }
        }
        
        return null;
    }
    
    // Enhanced element interactability check
    function isElementInteractable(element) {
        if (!element) return false;
        
        const style = getComputedStyle(element);
        return style.pointerEvents !== 'none' && 
               !element.disabled && 
               !element.readOnly &&
               element.tabIndex !== -1;
    }
    
    // Check if element is visible
    function isElementVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && 
               style.visibility !== 'hidden' && 
               style.display !== 'none';
    }
    
    // Improved text insertion method with success verification
    async function insertReplyWithImprovedMethod(replyText) {
        if (!replyText || typeof replyText !== 'string') {
            throw new Error('Invalid reply text');
        }
        
        // Note: defaultText is already added in background.js, so we don't add it here
        const finalText = replyText;
        
        const textarea = findReplyTextarea();
        if (!textarea) {
            throw new Error(ERROR_MESSAGES.TEXTAREA_NOT_FOUND);
        }
        
        // Use the improved paste method with success verification
        const success = await pasteInTwitterInput(finalText, textarea);
        
        if (!success) {
            // Try alternative insertion method as final fallback
            console.log('[X Auto Reply] Primary insertion failed, trying alternative method...');
            const alternativeSuccess = await insertReplyWithTyping(replyText);
            if (!alternativeSuccess) {
                throw new Error('All text insertion methods failed. Please try again.');
            }
        }
        
        // Show control buttons after successful text insertion
        showControlButtons();
        
        return success;
    }
    
    // Enhanced paste method with multiple insertion strategies and robust verification
    async function pasteInTwitterInput(text, textarea) {
        try {
            // Type guard: ensure textarea is a DOM element
            if (typeof textarea === 'string') {
                textarea = document.querySelector(textarea);
            }
            if (!textarea || !textarea.focus) {
                console.error('[X Auto Reply] Invalid textarea element');
                return false;
            }
            
            console.log('[X Auto Reply] Starting enhanced text insertion:', text.substring(0, 50) + '...');
            
            // Ensure element is ready for interaction
            textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await sleep(100);
            
            // Focus the textarea first
            textarea.focus();
            textarea.click();
            await sleep(300);
            
            // Try multiple methods with verification
            const methods = [
                () => enhancedClipboardMethod(textarea, text),
                () => enhancedInputEventMethod(textarea, text),
                () => enhancedDirectMethod(textarea, text),
                () => enhancedFallbackMethod(textarea, text)
            ];
            
            for (let i = 0; i < methods.length; i++) {
                try {
                    console.log(`[X Auto Reply] Trying method ${i + 1}...`);
                    const success = await methods[i]();
                    if (success && await verifyTextInsertion(textarea, text)) {
                        console.log(`[X Auto Reply] Method ${i + 1} successful!`);
                        await triggerTwitterEvents(textarea, text);
                        return true;
                    }
                } catch (e) {
                    console.log(`[X Auto Reply] Method ${i + 1} failed:`, e.message);
                }
                
                // Wait before trying next method
                await sleep(200);
            }
            
            console.error('[X Auto Reply] All insertion methods failed');
            return false;
            
        } catch (error) {
            console.error('[X Auto Reply] Error in pasteInTwitterInput:', error);
            return false;
        }
    }
    
    // Enhanced clipboard method with permission check and retry
    async function enhancedClipboardMethod(textarea, text) {
        try {
            // Check clipboard permissions
            const permission = await navigator.permissions.query({ name: 'clipboard-write' });
            if (permission.state === 'denied') {
                throw new Error('Clipboard permission denied');
            }
            
            // Write to clipboard with retry
            let clipboardSuccess = false;
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await navigator.clipboard.writeText(text);
                    clipboardSuccess = true;
                    break;
                } catch (e) {
                    if (attempt === 2) throw e;
                    await sleep(100);
                }
            }
            
            if (!clipboardSuccess) {
                throw new Error('Failed to write to clipboard');
            }
            
            // Clear existing content
            await clearTextareaCompletely(textarea);
            await sleep(200);
            
            // Create and dispatch paste event
            const dataTransfer = new DataTransfer();
            dataTransfer.setData('text/plain', text);
            
            const pasteEvent = new ClipboardEvent('paste', {
                bubbles: true,
                cancelable: true,
                clipboardData: dataTransfer
            });
            
            textarea.focus();
            const handled = textarea.dispatchEvent(pasteEvent);
            
            // Wait for processing
            await sleep(500);
            
            return handled;
            
        } catch (error) {
            throw new Error(`Clipboard method failed: ${error.message}`);
        }
    }
    
    // Enhanced InputEvent method with better event handling
    async function enhancedInputEventMethod(textarea, text) {
        try {
            // Clear existing content
            await clearTextareaCompletely(textarea);
            await sleep(200);
            
            // Focus and prepare
            textarea.focus();
            await sleep(100);
            
            // Set content first
            textarea.textContent = text;
            
            // Create comprehensive input event
            const inputEvent = new InputEvent('input', {
                inputType: 'insertText',
                data: text,
                bubbles: true,
                cancelable: true,
                composed: true
            });
            
            // Dispatch with proper target
            Object.defineProperty(inputEvent, 'target', { 
                writable: false, 
                value: textarea 
            });
            
            const handled = textarea.dispatchEvent(inputEvent);
            
            // Additional events for React/Draft.js
            const beforeInputEvent = new InputEvent('beforeinput', {
                inputType: 'insertText',
                data: text,
                bubbles: true,
                cancelable: true
            });
            
            textarea.dispatchEvent(beforeInputEvent);
            
            await sleep(300);
            return handled;
            
        } catch (error) {
            throw new Error(`InputEvent method failed: ${error.message}`);
        }
    }
    
    // Enhanced direct method with DOM manipulation
    async function enhancedDirectMethod(textarea, text) {
        try {
            // Clear existing content
            await clearTextareaCompletely(textarea);
            await sleep(200);
            
            // Focus
            textarea.focus();
            await sleep(100);
            
            // Check if it's a Draft.js editor
            const isDraftEditor = textarea.classList.contains('public-DraftEditor-content') || 
                                 textarea.closest('.public-DraftEditor-content');
            
            if (isDraftEditor) {
                // Handle Draft.js specifically
                await insertIntoDraftEditor(textarea, text);
            } else {
                // Handle regular contenteditable
                textarea.textContent = text;
                
                // Set cursor at end
                const range = document.createRange();
                const selection = window.getSelection();
                
                if (textarea.childNodes.length > 0) {
                    range.setStartAfter(textarea.lastChild);
                } else {
                    range.setStart(textarea, 0);
                }
                
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            // Trigger change events
            const changeEvent = new Event('change', { bubbles: true });
            textarea.dispatchEvent(changeEvent);
            
            await sleep(200);
            return true;
            
        } catch (error) {
            throw new Error(`Direct method failed: ${error.message}`);
        }
    }
    
    // Enhanced fallback method with typing simulation
    async function enhancedFallbackMethod(textarea, text) {
        try {
            // Clear existing content
            await clearTextareaCompletely(textarea);
            await sleep(200);
            
            // Focus
            textarea.focus();
            await sleep(100);
            
            // Simulate typing character by character for critical cases
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                
                // Add character
                textarea.textContent += char;
                
                // Trigger input event for each character
                const inputEvent = new InputEvent('input', {
                    inputType: 'insertText',
                    data: char,
                    bubbles: true,
                    cancelable: true
                });
                
                textarea.dispatchEvent(inputEvent);
                
                // Small delay to simulate human typing
                await sleep(10);
            }
            
            await sleep(200);
            return true;
            
        } catch (error) {
            throw new Error(`Fallback method failed: ${error.message}`);
        }
    }
    
    // Robust text insertion verification
    async function verifyTextInsertion(textarea, expectedText) {
        try {
            // Wait for DOM updates
            await sleep(300);
            
            // Multiple verification methods
            const verifications = [
                () => textarea.textContent.includes(expectedText),
                () => textarea.innerText.includes(expectedText),
                () => textarea.value && textarea.value.includes(expectedText),
                () => {
                    const computedText = window.getComputedStyle(textarea, '::before').content;
                    return computedText && computedText.includes(expectedText);
                }
            ];
            
            // Check if any verification method confirms success
            for (const verify of verifications) {
                try {
                    if (verify()) {
                        console.log('[X Auto Reply] Text insertion verified successfully');
                        return true;
                    }
                } catch (e) {
                    // Continue to next verification method
                }
            }
            
            // Additional check for Draft.js
            const draftContent = textarea.querySelector('.public-DraftStyleDefault-block');
            if (draftContent && draftContent.textContent.includes(expectedText)) {
                console.log('[X Auto Reply] Text insertion verified in Draft.js');
                return true;
            }
            
            console.log('[X Auto Reply] Text insertion verification failed');
            return false;
            
        } catch (error) {
            console.error('[X Auto Reply] Error in verification:', error);
            return false;
        }
    }
    
    // Insert reply with direct pasting - simplified and fast
    async function insertReplyWithTyping(replyText) {
        if (!replyText || typeof replyText !== 'string') {
            throw new Error('Invalid reply text');
        }
        
        // Note: defaultText is already added in background.js, so we don't add it here
        const finalText = replyText;
        
        const textarea = findReplyTextarea();
        if (!textarea) {
            throw new Error(ERROR_MESSAGES.TEXTAREA_NOT_FOUND);
        }
        
        // Ensure textarea is visible and ready
        textarea.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(200);
        
        // Focus and prepare textarea
        textarea.focus();
        textarea.click();
        await sleep(300);
        
        // Use improved text insertion method and return success status
        const success = await pasteInTwitterInput(finalText, textarea);
        
        if (success) {
            // Show control buttons after successful text insertion
            showControlButtons();
        }
        
        return success;
    }
    
    // Modern text insertion without deprecated APIs
    async function directTextInsertion(textarea, finalText) {
        try {
            // Clear existing content first
            await clearTextareaCompletely(textarea);
            await sleep(200);
            
            // Focus the textarea
            textarea.focus();
            await sleep(100);
            
            // Method 1: Use modern Clipboard API with paste event
            try {
                await navigator.clipboard.writeText(finalText);
                
                const pasteEvent = new ClipboardEvent('paste', {
                    clipboardData: new DataTransfer(),
                    bubbles: true,
                    cancelable: true
                });
                
                pasteEvent.clipboardData.setData('text/plain', finalText);
                
                if (textarea.dispatchEvent(pasteEvent)) {
                    await sleep(100);
                    await triggerTwitterEvents(textarea, finalText);
                    return;
                }
            } catch (e) {
                console.log('Clipboard API failed, trying InputEvent method');
            }
            
            // Method 2: Use InputEvent API (modern replacement for execCommand)
            try {
                const inputEvent = new InputEvent('input', {
                    inputType: 'insertText',
                    data: finalText,
                    bubbles: true,
                    cancelable: true
                });
                
                // Set the text content first
                textarea.textContent = finalText;
                
                // Dispatch the input event
                textarea.dispatchEvent(inputEvent);
                
                await sleep(100);
                await triggerTwitterEvents(textarea, finalText);
                return;
            } catch (e) {
                console.log('InputEvent failed, using direct insertion');
            }
            
            // Method 3: Direct text insertion with proper structure
            await insertTextDirectly(textarea, finalText);
            
        } catch (error) {
            console.error('Error in directTextInsertion:', error);
            // Fallback
            textarea.textContent = finalText;
            await triggerTwitterEvents(textarea, finalText);
        }
    }
    
    // Insert text directly into the textarea
    async function insertTextDirectly(textarea, finalText) {
        // Check if this is a Draft.js editor
        const isDraftEditor = textarea.classList.contains('public-DraftEditor-content') || 
                             textarea.closest('.public-DraftEditor-content');
        
        if (isDraftEditor) {
            // Handle Draft.js editor
            await insertIntoDraftEditor(textarea, finalText);
        } else {
            // Handle regular contenteditable
            textarea.textContent = finalText;
        }
        
        // Trigger events immediately
        await triggerTwitterEvents(textarea, finalText);
    }
    
    // Insert into Draft.js editor structure
    async function insertIntoDraftEditor(textarea, finalText) {
        // Clear Draft.js content first
        textarea.innerHTML = '';
        
        // Create proper Draft.js structure
        const blockElement = document.createElement('div');
        blockElement.className = 'public-DraftStyleDefault-block public-DraftStyleDefault-ltr';
        blockElement.setAttribute('data-offset-key', 'draft-js-block-key');
        
        const textSpan = document.createElement('span');
        textSpan.setAttribute('data-text', 'true');
        textSpan.textContent = finalText;
        
        blockElement.appendChild(textSpan);
        textarea.appendChild(blockElement);
        
        // Hide placeholder completely
        const placeholderElements = document.querySelectorAll('.public-DraftEditorPlaceholder-root, .public-DraftEditorPlaceholder-inner');
        placeholderElements.forEach(el => {
            el.style.display = 'none';
            el.style.visibility = 'hidden';
            el.style.opacity = '0';
        });
        
        // Set cursor at the end
        const range = document.createRange();
        const selection = window.getSelection();
        
        if (textSpan.childNodes.length > 0) {
            const textNode = textSpan.childNodes[0];
            range.setStart(textNode, finalText.length);
        } else {
            range.setStart(textSpan, 0);
        }
        
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    // Enhanced comprehensive events to activate Twitter's reply button
    async function triggerTwitterEvents(textarea, finalText) {
        console.log('[X Auto Reply] Triggering Twitter events for text:', finalText.substring(0, 30) + '...');
        
        const events = [
            // Focus events (critical for Twitter)
            { type: 'focus', bubbles: true },
            { type: 'focusin', bubbles: true },
            
            // Input events (primary for content detection)
            { type: 'input', bubbles: true, inputType: 'insertText', data: finalText },
            { type: 'beforeinput', bubbles: true, inputType: 'insertText', data: finalText },
            
            // Composition events (important for Draft.js and React)
            { type: 'compositionstart', bubbles: true, data: '' },
            { type: 'compositionupdate', bubbles: true, data: finalText },
            { type: 'compositionend', bubbles: true, data: finalText },
            
            // Keyboard events (simulate user typing)
            { type: 'keydown', bubbles: true, key: 'Unidentified', keyCode: 229, which: 229 },
            { type: 'keypress', bubbles: true, key: 'Unidentified', keyCode: 229, which: 229 },
            { type: 'keyup', bubbles: true, key: 'Unidentified', keyCode: 229, which: 229 },
            
            // Text input events
            { type: 'textInput', bubbles: true, data: finalText },
            
            // Change events
            { type: 'change', bubbles: true },
            
            // Additional events for React/Twitter detection
            { type: 'paste', bubbles: true },
            { type: 'cut', bubbles: true },
            { type: 'select', bubbles: true }
        ];
        
        for (const eventConfig of events) {
            try {
                let event;
                
                if (eventConfig.type.startsWith('key')) {
                    event = new KeyboardEvent(eventConfig.type, eventConfig);
                } else if (eventConfig.type === 'input' || eventConfig.type === 'beforeinput') {
                    event = new InputEvent(eventConfig.type, eventConfig);
                } else if (eventConfig.type.startsWith('composition')) {
                    event = new CompositionEvent(eventConfig.type, eventConfig);
                } else {
                    event = new Event(eventConfig.type, eventConfig);
                }
                
                // Set target
                Object.defineProperty(event, 'target', { writable: false, value: textarea });
                
                textarea.dispatchEvent(event);
                await sleep(5); // Very short delay
                
            } catch (error) {
                console.log(`Event ${eventConfig.type} dispatch error (non-critical):`, error);
            }
        }
        
        // Final focus and selection
        textarea.focus();
        
        // Additional Twitter-specific triggers
        await sleep(50);
        
        // Trigger a final input event to ensure Twitter recognizes the change
        const finalInputEvent = new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: finalText
        });
        
        Object.defineProperty(finalInputEvent, 'target', { writable: false, value: textarea });
        textarea.dispatchEvent(finalInputEvent);
        
        // Force focus again
        textarea.focus();
    }
    
    // Complete textarea clearing function
    async function clearTextareaCompletely(textarea) {
        if (!textarea) return;
        
        try {
            // Method 0: Handle Draft.js placeholder specifically
            const placeholderRoot = document.querySelector('.public-DraftEditorPlaceholder-root');
            const placeholderInner = document.querySelector('.public-DraftEditorPlaceholder-inner');
            
            if (placeholderRoot || placeholderInner) {
                // Hide the placeholder elements
                if (placeholderRoot) {
                    placeholderRoot.style.display = 'none';
                }
                if (placeholderInner) {
                    placeholderInner.style.display = 'none';
                }
                
                // Focus on the actual editor content
                const draftContent = document.querySelector('.public-DraftEditor-content');
                if (draftContent) {
                    textarea = draftContent;
                }
            }
            
            // Method 1: Focus and clear using modern APIs
            textarea.focus();
            await sleep(100);
            
            // Use modern selection and deletion
            try {
                // Select all content using Selection API
                const selection = window.getSelection();
                const range = document.createRange();
                range.selectNodeContents(textarea);
                selection.removeAllRanges();
                selection.addRange(range);
                
                // Use InputEvent to delete content
                const deleteEvent = new InputEvent('input', {
                    inputType: 'deleteContent',
                    bubbles: true,
                    cancelable: true
                });
                
                textarea.textContent = '';
                textarea.dispatchEvent(deleteEvent);
                await sleep(100);
            } catch (e) {
                console.log('Modern deletion failed, using direct clearing');
                textarea.textContent = '';
                textarea.innerHTML = '';
            }
            
            // Method 2: Clear content directly
            textarea.innerHTML = '';
            textarea.textContent = '';
            
            // Method 3: Handle Draft.js specific clearing
            const draftEditorBlock = textarea.querySelector('.public-DraftStyleDefault-block');
            if (draftEditorBlock) {
                draftEditorBlock.innerHTML = '';
                draftEditorBlock.textContent = '';
            }
            
            // Method 4: Remove placeholder styling
            const computedStyle = window.getComputedStyle(textarea);
            if (computedStyle.color === 'rgb(83, 100, 113)' || // Twitter's placeholder color
                computedStyle.color === 'rgb(139, 152, 165)') { // Dark mode placeholder
                
                // Create and insert a space then delete it to reset styling
                textarea.textContent = ' ';
                await sleep(50);
                
                if (document.execCommand) {
                    document.execCommand('selectAll');
                    document.execCommand('delete');
                }
                
                textarea.innerHTML = '';
                textarea.textContent = '';
            }
            
            // Method 5: Reset any pseudo-element content
            textarea.setAttribute('data-text', '');
            textarea.style.setProperty('--placeholder', '""');
            
            // Method 6: Clear Draft.js specific attributes
            if (textarea.hasAttribute('data-contents')) {
                textarea.setAttribute('data-contents', 'true');
            }
            
            // Trigger events to notify React/Draft.js
            const events = [
                new Event('focus', { bubbles: true }),
                new Event('input', { bubbles: true }),
                new Event('change', { bubbles: true }),
                new KeyboardEvent('keydown', { bubbles: true, key: 'Backspace' }),
                new KeyboardEvent('keyup', { bubbles: true, key: 'Backspace' })
            ];
            
            for (const event of events) {
                Object.defineProperty(event, 'target', { writable: false, value: textarea });
                textarea.dispatchEvent(event);
                await sleep(10);
            }
            
            // Final focus
            textarea.focus();
            
        } catch (error) {
            console.error('Error in clearTextareaCompletely:', error);
        }
    }
    
    // Show control buttons after text insertion
    function showControlButtons() {
        const textarea = findReplyTextarea();
        if (!textarea) return;
        
        // Find a suitable container for controls
        const container = textarea.closest('[data-testid="toolBar"]') || 
                         textarea.closest('div[role="group"]') ||
                         textarea.parentElement?.parentElement;
        
        if (!container) return;
        
        // Remove existing controls
        const existingControls = container.querySelector(`.${CSS_CLASSES.replyControls}`);
        if (existingControls) {
            existingControls.remove();
        }
        
        // Create controls container
        const controls = document.createElement('div');
        controls.className = CSS_CLASSES.replyControls;
        controls.style.cssText = `
            display: flex;
            gap: 8px;
            margin-top: 8px;
            padding: 8px;
            background-color: rgba(247, 249, 249, 0.8);
            border-radius: 8px;
            backdrop-filter: blur(10px);
        `;
        
        // New Reply button
        const newReplyBtn = document.createElement('button');
        newReplyBtn.className = CSS_CLASSES.controlBtn;
        newReplyBtn.innerHTML = '<i class="fas fa-redo"></i> Generate New';
        newReplyBtn.style.cssText = `
            padding: 6px 12px;
            border-radius: 9999px;
            border: 1px solid rgb(207, 217, 222);
            background-color: white;
            color: rgb(15, 20, 25);
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        
        newReplyBtn.onclick = async () => {
            controls.remove();
            // Find and click the auto reply button again
            const autoReplyBtn = document.querySelector(`.${CSS_CLASSES.autoReplyBtn}`);
            if (autoReplyBtn) {
                autoReplyBtn.click();
            }
        };
        
        // Send button
        const sendBtn = document.createElement('button');
        sendBtn.className = CSS_CLASSES.controlBtn;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reply';
        sendBtn.style.cssText = `
            padding: 6px 12px;
            border-radius: 9999px;
            border: 1px solid rgb(29, 155, 240);
            background-color: rgb(29, 155, 240);
            color: white;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
        `;
        
        sendBtn.onclick = () => {
            const tweetButton = document.querySelector(SELECTORS.tweetButton);
            if (tweetButton && !tweetButton.disabled) {
                controls.remove();
                tweetButton.click();
            }
        };
        
        // Add hover effects
        newReplyBtn.onmouseenter = () => newReplyBtn.style.backgroundColor = 'rgb(247, 249, 249)';
        newReplyBtn.onmouseleave = () => newReplyBtn.style.backgroundColor = 'white';
        
        sendBtn.onmouseenter = () => sendBtn.style.backgroundColor = 'rgb(26, 140, 216)';
        sendBtn.onmouseleave = () => sendBtn.style.backgroundColor = 'rgb(29, 155, 240)';
        
        controls.appendChild(newReplyBtn);
        controls.appendChild(sendBtn);
        
        // Insert controls after the textarea container
        container.appendChild(controls);
    }
    
    // Update button state
    function updateButtonState(button, state) {
        if (!button || !BUTTON_STATES[state]) return;
        button.className = `${CSS_CLASSES.autoReplyBtn} ${state}`;
        button.textContent = BUTTON_STATES[state];
    }
    
    // Get random delay
    function getRandomDelay() {
        const range = settings.delayRange || '3-8';
        const [min, max] = range.split('-').map(n => parseInt(n) * 1000);
        return min + Math.random() * (max - min);
    }
    
    // Get typing speed
    function getTypingSpeed() {
        return TYPING_SPEEDS[settings.typingSpeed || 'normal'];
    }
    
    // Wait for element with multiple selectors - improved version
    function waitForElement(selectors, timeout = 5000) {
        const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
        
        return new Promise((resolve, reject) => {
            // Check if element already exists
            for (const selector of selectorArray) {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    if (element && 
                        (element.isContentEditable || element.tagName === 'TEXTAREA') &&
                        element.offsetParent !== null) {
                resolve(element);
                return;
                    }
                }
            }
            
            const observer = new MutationObserver((mutations, obs) => {
                for (const selector of selectorArray) {
                    const elements = document.querySelectorAll(selector);
                    for (const element of elements) {
                        if (element && 
                            (element.isContentEditable || element.tagName === 'TEXTAREA') &&
                            element.offsetParent !== null) {
                    obs.disconnect();
                    resolve(element);
                            return;
                        }
                    }
                }
            });
            
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            setTimeout(() => {
                observer.disconnect();
                reject(new Error(`Elements not found: ${selectorArray.join(', ')}`));
            }, timeout);
        });
    }
    
    // Show toast notification
    function showToast(message, type = 'info') {
        try {
            // Remove existing toasts
            const existingContainer = document.querySelector(`.${CSS_CLASSES.toastContainer}`);
            if (existingContainer) {
                existingContainer.remove();
            }
            
            // Create container
            const container = document.createElement('div');
            container.className = CSS_CLASSES.toastContainer;
            
            // Create toast
            const toast = document.createElement('div');
            toast.className = `${CSS_CLASSES.toast} ${type}`;
            toast.textContent = message;
            
            container.appendChild(toast);
            document.body.appendChild(container);
            
            // Auto remove after 3 seconds
            setTimeout(() => {
                if (container.parentElement) {
                    container.remove();
                }
            }, 3000);
        } catch (error) {
            // Fallback to console if toast fails
            console.log(`[X Auto Reply] ${type.toUpperCase()}: ${message}`);
        }
    }
    
    // Handle messages
    function handleMessage(request, sender, sendResponse) {
        if (request.action === 'settingsUpdated') {
            console.log('📢 [CONTENT] Received settings update from popup:', request.settings);
            const oldProvider = settings.provider;
            const oldModel = settings[`${oldProvider}Model`];
            
            settings = request.settings;
            
            const newProvider = settings.provider;
            const newModel = settings[`${newProvider}Model`];
            
            console.log('🔄 [CONTENT] Settings updated:', {
                oldProvider,
                oldModel,
                newProvider,
                newModel,
                changed: oldProvider !== newProvider || oldModel !== newModel,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // Sleep utility
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Tweet composer detection and AI button injection
    let injectedComposerButtons = new Set();
    
    function checkForComposer() {
        const isComposePage = window.location.pathname === '/compose/tweet';
        const homeComposer = document.querySelector('[data-testid="tweetTextarea_0"]');
        
        if (isComposePage || homeComposer) {
            // Look for tweet buttons to inject AI button next to
            const tweetButtons = document.querySelectorAll('[data-testid="tweetButtonInline"], [data-testid="tweetButton"]');
            tweetButtons.forEach(button => {
                if (!injectedComposerButtons.has(button)) {
                    injectAIButton(button);
                    injectedComposerButtons.add(button);
                }
            });
        }
    }
    
    function openAIModal() {
         // Check if modal already exists
         if (document.getElementById('ai-tweet-modal-overlay')) {
             return;
         }
         
         // Create modal overlay
         const overlay = document.createElement('div');
         overlay.id = 'ai-tweet-modal-overlay';
         overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.4); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        
        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = 'background: white; border-radius: 16px; padding: 24px; width: 400px; max-width: 90vw; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);';
        
        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #0f1419;">✨ AI Tweet Generator</h2>
                <button id="closeModal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #536471;">×</button>
            </div>
            <input type="text" id="tweetTopic" placeholder="What do you want to tweet about?" 
                style="width: 100%; padding: 12px; border: 2px solid #e1e8ed; border-radius: 8px; margin-bottom: 16px; font-size: 16px; box-sizing: border-box;">
            <div style="display: flex; gap: 16px; margin-bottom: 16px;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="tone" value="casual" checked> Casual
                </label>
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="tone" value="professional"> Professional
                </label>
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 20px; align-items: center;">
                <span style="font-weight: 500;">Length:</span>
                <input type="number" id="minWords" value="10" min="5" max="50" 
                    style="width: 60px; padding: 8px; border: 2px solid #e1e8ed; border-radius: 4px; text-align: center;">
                <span>-</span>
                <input type="number" id="maxWords" value="30" min="5" max="50" 
                    style="width: 60px; padding: 8px; border: 2px solid #e1e8ed; border-radius: 4px; text-align: center;">
                <span>words</span>
            </div>
            <div style="display: flex; gap: 12px;">
                <button id="generateTweetBtn" 
                    style="flex: 1; padding: 12px 24px; border: none; border-radius: 9999px;
                           background: #1d9bf0; color: white; font-weight: 700; cursor: pointer; font-size: 15px;">
                    ✨ Generate Tweet
                </button>
                <button id="cancelTweetBtn" 
                    style="padding: 12px 24px; border: 2px solid #cfd9de; border-radius: 9999px;
                           background: white; color: #0f1419; font-weight: 700; cursor: pointer; font-size: 15px;">
                    Cancel
                </button>
            </div>
        `;
        
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        
        // Event listeners
          const escapeHandler = (e) => {
              if (e.key === 'Escape') {
                  overlay.remove();
                  document.removeEventListener('keydown', escapeHandler);
              }
          };
          
          // Store escape handler on overlay for cleanup
          overlay.escapeHandler = escapeHandler;
          
          const closeModal = () => {
              overlay.remove();
              document.removeEventListener('keydown', escapeHandler);
          };
          
          modal.querySelector('#closeModal').onclick = closeModal;
          modal.querySelector('#cancelTweetBtn').onclick = closeModal;
          modal.querySelector('#generateTweetBtn').onclick = () => handleGenerateTweet(overlay);
          overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
          document.addEventListener('keydown', escapeHandler);
        
        // Auto-focus topic input
        setTimeout(() => modal.querySelector('#tweetTopic').focus(), 100);
    }
    
    function injectAIButton(tweetButton) {
        if (!tweetButton || tweetButton.dataset.aiButtonInjected) return;
        
        try {
            // Create the AI button with enhanced styling
            const aiButton = document.createElement('button');
            aiButton.setAttribute('role', 'button');
            aiButton.setAttribute('aria-label', 'Generate tweet with AI');
            aiButton.className = 'ai-tweet-btn';
            aiButton.textContent = '✨ Write with AI';
            
            // Add click event listener with proper cleanup tracking
            const clickHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                injectTweetGeneratorModal();
            };
            
            addTrackedEventListener(aiButton, 'click', clickHandler);
            
            // Find the best insertion point
            const container = tweetButton.parentNode;
            if (container) {
                // Insert button after the tweet button with proper positioning
                if (tweetButton.nextSibling) {
                    container.insertBefore(aiButton, tweetButton.nextSibling);
                } else {
                    container.appendChild(aiButton);
                }
                
                // Mark as injected
                tweetButton.dataset.aiButtonInjected = 'true';
                
                // Track the button for cleanup
                STATE.injectedButtons.add(aiButton);
                
                console.log('[X Auto Reply] AI button injected successfully');
            }
        } catch (error) {
            console.error('Failed to inject AI button:', error);
        }
    }
    
    // Modal functionality is now handled inline in openAIModal()
    
    // Inject neumorphic styles for tweet generator modal
    function injectTweetGeneratorStyles() {
        if (document.getElementById('ai-tweet-modal-styles')) return;
        
        const styleTag = document.createElement('style');
        styleTag.id = 'ai-tweet-modal-styles';
        styleTag.textContent = `
            /* Neumorphic Tweet Generator Modal Styles */
            .ai-tweet-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(4px);
            }
            
            .ai-tweet-modal {
                background: #e0e0e0;
                border-radius: 20px;
                padding: 32px;
                width: 90%;
                max-width: 480px;
                box-shadow: 
                    8px 8px 16px #bebebe,
                    -8px -8px 16px #ffffff;
                font-family: TwitterChirp, JetBrains Mono, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                position: relative;
                animation: modalSlideIn 0.3s ease-out;
            }
            
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: scale(0.9) translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }
            
            .ai-tweet-modal h2 {
                margin: 0 0 24px 0;
                font-size: 24px;
                font-weight: 700;
                color: #14171a;
                text-align: center;
            }
            
            .ai-tweet-modal-form {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }
            
            .ai-tweet-modal-input {
                background: #e0e0e0;
                border: none;
                border-radius: 12px;
                padding: 16px 20px;
                font-size: 16px;
                font-family: inherit;
                color: #14171a;
                box-shadow: 
                    inset 4px 4px 8px #bebebe,
                    inset -4px -4px 8px #ffffff;
                transition: all 0.2s ease;
                resize: vertical;
                min-height: 80px;
            }
            
            .ai-tweet-modal-input:focus {
                outline: none;
                box-shadow: 
                    inset 4px 4px 8px #bebebe,
                    inset -4px -4px 8px #ffffff,
                    0 0 0 2px #ff6b35;
            }
            
            .ai-tweet-modal-input::placeholder {
                color: #657786;
            }
            
            .ai-tweet-modal-radio-group {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 12px;
                margin-bottom: 4px;
            }
            
            .ai-tweet-modal-radio-label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                font-weight: 500;
                color: #14171a;
                transition: color 0.2s ease;
            }
            
            .ai-tweet-modal-radio-label:hover {
                color: #ff6b35;
            }
            
            .ai-tweet-modal-radio {
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #e0e0e0;
                box-shadow: 
                    inset 2px 2px 4px #bebebe,
                    inset -2px -2px 4px #ffffff;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
            }
            
            .ai-tweet-modal-radio:checked {
                background: #ff6b35;
                box-shadow: 
                    inset 2px 2px 4px #d4571f,
                    inset -2px -2px 4px #ff7f4b;
            }
            
            .ai-tweet-modal-radio:checked::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #ffffff;
                box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
            }
            
            .ai-tweet-modal-length-group {
                display: flex;
                gap: 12px;
                align-items: center;
                font-weight: 500;
                color: #14171a;
            }
            
            .ai-tweet-modal-number-input {
                width: 60px;
                background: #e0e0e0;
                border: none;
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 14px;
                font-family: inherit;
                color: #14171a;
                text-align: center;
                box-shadow: 
                    inset 2px 2px 4px #bebebe,
                    inset -2px -2px 4px #ffffff;
                transition: all 0.2s ease;
            }
            
            .ai-tweet-modal-number-input:focus {
                outline: none;
                box-shadow: 
                    inset 2px 2px 4px #bebebe,
                    inset -2px -2px 4px #ffffff,
                    0 0 0 2px #ff6b35;
            }
            
            .ai-tweet-modal-buttons {
                display: flex;
                gap: 12px;
                margin-top: 8px;
            }
            
            .ai-tweet-modal-btn {
                flex: 1;
                padding: 14px 24px;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                font-family: inherit;
                cursor: pointer;
                transition: all 0.2s ease;
                position: relative;
                overflow: hidden;
            }
            
            .ai-tweet-modal-btn-primary {
                background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%);
                color: #ffffff;
                box-shadow: 
                    4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
            }
            
            .ai-tweet-modal-btn-primary:hover:not(:disabled) {
                background: linear-gradient(135deg, #ff7f4b 0%, #ff8c42 100%);
                transform: translateY(-1px);
                box-shadow: 
                    6px 6px 12px #bebebe,
                    -6px -6px 12px #ffffff;
            }
            
            .ai-tweet-modal-btn-primary:active:not(:disabled) {
                transform: translateY(0);
                box-shadow: 
                    2px 2px 4px #bebebe,
                    -2px -2px 4px #ffffff;
            }
            
            .ai-tweet-modal-btn-primary:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .ai-tweet-modal-btn-secondary {
                background: #e0e0e0;
                color: #14171a;
                box-shadow: 
                    4px 4px 8px #bebebe,
                    -4px -4px 8px #ffffff;
            }
            
            .ai-tweet-modal-btn-secondary:hover {
                background: #d6d6d6;
                transform: translateY(-1px);
                box-shadow: 
                    6px 6px 12px #bebebe,
                    -6px -6px 12px #ffffff;
            }
            
            .ai-tweet-modal-btn-secondary:active {
                transform: translateY(0);
                box-shadow: 
                    inset 2px 2px 4px #bebebe,
                    inset -2px -2px 4px #ffffff;
            }
            
            /* Dark mode support */
            html[data-color-mode="dark"] .ai-tweet-modal {
                background: #202020;
                box-shadow: 
                    inset 2px 2px 4px #121212,
                    inset -2px -2px 4px #2e2e2e;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal h2 {
                color: #ffffff;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-input {
                background: #202020;
                color: #ffffff;
                box-shadow: 
                    inset 2px 2px 4px #121212,
                    inset -2px -2px 4px #2e2e2e;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-input:focus {
                box-shadow: 
                    inset 2px 2px 4px #121212,
                    inset -2px -2px 4px #2e2e2e,
                    0 0 0 2px #ff6b35;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-input::placeholder {
                color: #8b98a5;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-radio-label {
                color: #ffffff;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-radio {
                background: #202020;
                box-shadow: 
                    inset 2px 2px 4px #121212,
                    inset -2px -2px 4px #2e2e2e;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-number-input {
                background: #202020;
                color: #ffffff;
                box-shadow: 
                    inset 2px 2px 4px #121212,
                    inset -2px -2px 4px #2e2e2e;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-number-input:focus {
                box-shadow: 
                    inset 2px 2px 4px #121212,
                    inset -2px -2px 4px #2e2e2e,
                    0 0 0 2px #ff6b35;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-length-group {
                color: #ffffff;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-btn-secondary {
                background: #202020;
                color: #ffffff;
                box-shadow: 
                    inset 2px 2px 4px #121212,
                    inset -2px -2px 4px #2e2e2e;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-btn-secondary:hover {
                background: #2a2a2a;
                box-shadow: 
                    inset 2px 2px 4px #121212,
                    inset -2px -2px 4px #2e2e2e;
            }
            
            html[data-color-mode="dark"] .ai-tweet-modal-btn-secondary:active {
                box-shadow: 
                    inset 4px 4px 8px #121212,
                    inset -4px -4px 8px #2e2e2e;
            }
            
            /* Reduced motion support */
            @media (prefers-reduced-motion: reduce) {
                .ai-tweet-modal {
                    animation: none;
                }
                
                .ai-tweet-modal-btn,
                .ai-tweet-modal-input,
                .ai-tweet-modal-radio,
                .ai-tweet-modal-number-input {
                    transition: none;
                }
            }
            
            /* High contrast support */
            @media (prefers-contrast: high) {
                .ai-tweet-modal {
                    border: 2px solid #000000;
                }
                
                .ai-tweet-modal-input:focus,
                .ai-tweet-modal-number-input:focus {
                    border: 2px solid #ff6b35;
                }
                
                html[data-color-mode="dark"] .ai-tweet-modal {
                    border: 2px solid #ffffff;
                }
            }
        `;
        
        document.head.appendChild(styleTag);
    }
    
    // Inject neumorphic tweet generator modal
    function injectTweetGeneratorModal() {
        // Check if modal already exists
        if (document.getElementById('ai-tweet-modal-overlay')) {
            return;
        }
        
        // Inject styles first
        injectTweetGeneratorStyles();
        
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'ai-tweet-modal-overlay';
        overlay.className = 'ai-tweet-modal-overlay';
        
        // Create modal content
        overlay.innerHTML = `
            <div class="ai-tweet-modal">
                <h2>✨ Generate Tweet</h2>
                <form class="ai-tweet-modal-form">
                    <textarea 
                        id="ai-tweet-topic" 
                        class="ai-tweet-modal-input" 
                        placeholder="What's your tweet about? (e.g., 'productivity tips for developers')"
                        rows="3"
                        required
                    ></textarea>
                    
                    <div class="ai-tweet-modal-radio-group">
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="casual" class="ai-tweet-modal-radio" checked>
                            Casual
                        </label>
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="professional" class="ai-tweet-modal-radio">
                            Professional
                        </label>
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="humorous" class="ai-tweet-modal-radio">
                            Humorous
                        </label>
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="formal" class="ai-tweet-modal-radio">
                            Formal
                        </label>
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="pro-plus" class="ai-tweet-modal-radio">
                            Pro-Plus
                        </label>
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="academic" class="ai-tweet-modal-radio">
                            Academic
                        </label>
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="troll" class="ai-tweet-modal-radio">
                            Troll 🙄
                        </label>
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="bully" class="ai-tweet-modal-radio">
                            Bully 🤡
                        </label>
                        <label class="ai-tweet-modal-radio-label">
                            <input type="radio" name="ai-tweet-tone" value="roasting" class="ai-tweet-modal-radio">
                            Roasting 🐐
                        </label>
                    </div>
                    
                    <div class="ai-tweet-modal-length-group">
                        <span>Length:</span>
                        <input type="number" id="ai-tweet-min-words" class="ai-tweet-modal-number-input" value="10" min="5" max="50">
                        <span>-</span>
                        <input type="number" id="ai-tweet-max-words" class="ai-tweet-modal-number-input" value="30" min="5" max="50">
                        <span>words</span>
                    </div>
                    
                    <div class="ai-tweet-modal-buttons">
                        <button type="button" id="ai-tweet-cancel-btn" class="ai-tweet-modal-btn ai-tweet-modal-btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" id="ai-tweet-generate-btn" class="ai-tweet-modal-btn ai-tweet-modal-btn-primary">
                            ✨ Generate Tweet
                        </button>
                    </div>
                </form>
            </div>
        `;
        
        // Add event listeners
        const modal = overlay.querySelector('.ai-tweet-modal');
        const form = overlay.querySelector('.ai-tweet-modal-form');
        const topicInput = overlay.querySelector('#ai-tweet-topic');
        const cancelBtn = overlay.querySelector('#ai-tweet-cancel-btn');
        const generateBtn = overlay.querySelector('#ai-tweet-generate-btn');
        
        // Close modal function
        const closeModal = () => {
            document.removeEventListener('keydown', escapeHandler);
            overlay.remove();
            // Return focus to Twitter's composer
            const tweetTextarea = document.querySelector('[data-testid="tweetTextarea_0"]');
            if (tweetTextarea) {
                tweetTextarea.focus();
            }
        };
        
        // Escape key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeModal();
            }
        };
        
        // Event listeners
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });
        
        cancelBtn.addEventListener('click', closeModal);
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const topic = topicInput.value.trim();
            const toneInputs = overlay.querySelectorAll('input[name="ai-tweet-tone"]');
            const tone = Array.from(toneInputs).find(input => input.checked)?.value || 'casual';
            const minWords = parseInt(overlay.querySelector('#ai-tweet-min-words').value) || 10;
            const maxWords = parseInt(overlay.querySelector('#ai-tweet-max-words').value) || 30;
            
            if (!topic) {
                showToast('Please enter a topic', 'error');
                topicInput.focus();
                return;
            }
            
            // Disable generate button and show loading state
            generateBtn.disabled = true;
            generateBtn.textContent = '⏳ Generating...';
            
            try {
                // Fetch fresh settings to ensure provider switching works
                await loadSettings();
                
                const prompt = `You are a real human Twitter user writing an authentic tweet.

TOPIC: ${topic}
TONE: ${tone}
LENGTH: ${minWords}-${maxWords} words

HUMAN WRITING REQUIREMENTS:
1. Write in the same language as the topic
2. Use natural, conversational language
3. Include contractions (you're, don't, can't, won't)
4. ${tone === 'casual' ? 'Add 1-2 contextually relevant emojis naturally' : 'Keep professional, no emojis'}
5. Sometimes start with lowercase (20% chance)
6. Use natural punctuation variations (... or !! or ??)
7. Include casual abbreviations when appropriate (ur, ppl, thx, bc)

CRITICAL RULES:
- Write as a regular human, not an AI
- Be authentic and relatable
- Match the energy of the topic
- NO hashtags unless the topic specifically mentions one
- NO formal or robotic language
- NO explanations or metadata
- Output ONLY the tweet text, no quotes

Generate a natural, human-like tweet that feels authentic:`;
                
                const response = await safeRuntimeSendMessage({
                    type: 'generateTweet',
                    prompt: prompt,
                    settings: settings
                });
                
                if (response.success) {
                    const tweetTextarea = document.querySelector('[data-testid="tweetTextarea_0"]');
                    if (tweetTextarea) {
                        const insertSuccess = await pasteInTwitterInput(response.tweet, tweetTextarea);
                        if (insertSuccess) {
                            showToast('Tweet ready – edit & send!', 'success');
                            closeModal();
                        } else {
                            showToast('Tweet generated but insertion failed. Please paste manually.', 'warning');
                            // Copy to clipboard as fallback
                            try {
                                await navigator.clipboard.writeText(response.tweet);
                                showToast('Tweet copied to clipboard!', 'info');
                            } catch (e) {
                                console.error('Clipboard fallback failed:', e);
                            }
                        }
                    } else {
                        showToast('Could not find tweet composer', 'error');
                    }
                } else {
                    showToast(response.error || 'Failed to generate tweet', 'error');
                }
            } catch (error) {
                console.error('Tweet generation error:', error);
                showToast('Failed to generate tweet', 'error');
            } finally {
                generateBtn.disabled = false;
                generateBtn.textContent = '✨ Generate Tweet';
            }
        });
        
        // Add escape key listener
        document.addEventListener('keydown', escapeHandler);
        
        // Append to body and focus topic input
        document.body.appendChild(overlay);
        topicInput.focus();
    }
    
    async function handleGenerateTweet(overlay) {
        const modal = overlay.querySelector('div');
        const topicInput = modal.querySelector('#tweetTopic');
        const toneInputs = modal.querySelectorAll('input[name="tone"]');
        const minWordsInput = modal.querySelector('#minWords');
        const maxWordsInput = modal.querySelector('#maxWords');
        const generateBtn = modal.querySelector('#generateTweetBtn');
        
        const topic = topicInput.value.trim();
        const tone = Array.from(toneInputs).find(input => input.checked)?.value || 'casual';
        const minWords = parseInt(minWordsInput.value) || 10;
        const maxWords = parseInt(maxWordsInput.value) || 30;
        
        if (!topic) {
            showToast('Please enter a topic', 'error');
            return;
        }
        
        generateBtn.disabled = true;
        generateBtn.textContent = '⏳ Generating...';
        
        try {
            // Fetch fresh settings to ensure provider switching works
            await loadSettings();
            
            const prompt = `Write a single, engaging tweet in the same language as the topic.
Topic: ${topic}
Tone: ${tone}
Length: ${minWords}-${maxWords} words.
Do NOT include hashtags unless the topic contains one.
Sound human, use contractions, occasional emoji if ${tone === 'casual' ? 'casual' : 'professional'}.
Output ONLY the tweet text, no quotes.`;
            
            const response = await safeRuntimeSendMessage({
                type: 'generateTweet',
                prompt: prompt,
                settings: settings
            });
            
            if (response.success) {
                const textarea = document.querySelector('[data-testid="tweetTextarea_0"]');
                if (textarea) {
                    const insertSuccess = await pasteInTwitterInput(response.tweet, textarea);
                    if (insertSuccess) {
                        showToast('Tweet ready – edit & send!', 'success');
                        // Close modal and clean up
                        document.removeEventListener('keydown', overlay.escapeHandler);
                        overlay.remove();
                        textarea.focus();
                    } else {
                        showToast('Tweet generated but insertion failed. Please paste manually.', 'warning');
                        // Copy to clipboard as fallback
                        try {
                            await navigator.clipboard.writeText(response.tweet);
                            showToast('Tweet copied to clipboard!', 'info');
                        } catch (e) {
                            console.error('Clipboard fallback failed:', e);
                        }
                    }
                } else {
                    showToast('Could not find tweet composer', 'error');
                }
            } else {
                showToast(response.error || 'Failed to generate tweet', 'error');
            }
        } catch (error) {
            console.error('Tweet generation error:', error);
            showToast('Failed to generate tweet', 'error');
        } finally {
            generateBtn.disabled = false;
            generateBtn.textContent = '✨ Generate Tweet';
        }
    }
    
    // Enhanced cleanup function
    function performCleanup() {
        if (STATE.isCleanedUp) return;
        
        try {
            // Disconnect all observers
            STATE.observers.forEach(observer => {
                try {
                    observer.disconnect();
                } catch (e) {
                    console.warn('Failed to disconnect observer:', e);
                }
            });
            STATE.observers = [];
            
            // Remove all event listeners
            STATE.eventListeners.forEach((listener, element) => {
                try {
                    element.removeEventListener(listener.event, listener.handler, listener.options);
                } catch (e) {
                    console.warn('Failed to remove event listener:', e);
                }
            });
            STATE.eventListeners.clear();
            
            // Clear all timers
            STATE.timers.forEach(timerId => {
                try {
                    clearTimeout(timerId);
                } catch (e) {
                    console.warn('Failed to clear timer:', e);
                }
            });
            STATE.timers.clear();
            
            // Remove injected UI elements
            document.querySelectorAll(
                `.${CSS_CLASSES.autoReplyWrapper}, .${CSS_CLASSES.replyControls}, .${CSS_CLASSES.toastContainer}`
            ).forEach(el => {
                try {
                    el.remove();
                } catch (e) {
                    console.warn('Failed to remove element:', e);
                }
            });
            
            // Clear button references
            STATE.injectedButtons.clear();
            
            // Mark as cleaned up
            STATE.isCleanedUp = true;
            
            console.log('[X Auto Reply] Cleanup completed');
        } catch (error) {
            console.error('[X Auto Reply] Cleanup failed:', error);
        }
    }
    
    // Helper function to add tracked event listeners
    function addTrackedEventListener(element, event, handler, options = false) {
        element.addEventListener(event, handler, options);
        STATE.eventListeners.set(element, { event, handler, options });
    }
    
    // Helper function to add tracked timers
    function addTrackedTimer(callback, delay) {
        const timerId = setTimeout(callback, delay);
        STATE.timers.add(timerId);
        return timerId;
    }
    
    // Cleanup on page unload and navigation
    window.addEventListener('beforeunload', performCleanup);
    window.addEventListener('pagehide', performCleanup);
    
    // Cleanup on extension context invalidation
    if (chrome.runtime && chrome.runtime.onConnect) {
        chrome.runtime.onConnect.addListener(() => {
            // Extension reloaded, cleanup old instance
            performCleanup();
        });
    }
    
    // Handle page navigation
    let currentUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            STATE.injectedButtons.clear();
            setTimeout(processExistingTweets, 1000);
        }
    }).observe(document, { subtree: true, childList: true });
    
    // Force inject buttons (for debugging)
    window.forceInjectButtons = function() {
        console.log('🔧 Force injecting Auto Reply buttons...');
        
        // Clear existing injected buttons
        STATE.injectedButtons.forEach(btn => {
            try {
                btn.remove();
            } catch (e) {
                // Button may already be removed
            }
        });
        STATE.injectedButtons.clear();
        
        // Reset injection markers
        document.querySelectorAll('[data-auto-reply-injected]').forEach(btn => {
            btn.removeAttribute('data-auto-reply-injected');
        });
        
        // Force process all tweets
        processExistingTweets();
        
        setTimeout(() => {
            console.log('Force injection completed:');
            console.log('Auto Reply buttons found:', document.querySelectorAll(`.${CSS_CLASSES.autoReplyBtn}`).length);
        }, 500);
    };

    // Debug function to check Auto Reply buttons
    window.debugAutoReply = function() {
        console.log('🔍 Debug Auto Reply Status:');
        console.log('Extension context valid:', isExtensionContextValid());
        console.log('Reply buttons found:', document.querySelectorAll(SELECTORS.replyButton).length);
        console.log('Auto Reply buttons found:', document.querySelectorAll(`.${CSS_CLASSES.autoReplyBtn}`).length);
        console.log('Injected buttons count:', STATE.injectedButtons.size);
        console.log('Current settings:', settings);
        
        // Show detailed selector results
        console.log('Detailed selector check:');
        console.log('- [data-testid="reply"]:', document.querySelectorAll('[data-testid="reply"]').length);
        console.log('- [aria-label*="Reply"]:', document.querySelectorAll('[aria-label*="Reply"]').length);
        console.log('- [aria-label*="reply"]:', document.querySelectorAll('[aria-label*="reply"]').length);
        
        // Try to inject buttons manually
        console.log('🔧 Attempting manual injection...');
        processExistingTweets();
        
        setTimeout(() => {
            console.log('After manual injection:');
            console.log('Auto Reply buttons found:', document.querySelectorAll(`.${CSS_CLASSES.autoReplyBtn}`).length);
        }, 1000);
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
})();