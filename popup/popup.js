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

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  setupEventListeners();
  setupTabSwitching();
});

// Load settings from storage
async function loadSettings() {
  try {
    console.log('📖 [POPUP] Loading settings from chrome.storage.local...');
    
    // Check if Chrome APIs are available
    if (!chrome || !chrome.storage) {
      console.warn('Chrome APIs not available - using default settings');
      const settings = {
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
      
      // Populate UI with default settings
      populateUIWithSettings(settings);
      return;
    }
    
    const result = await chrome.storage.local.get(['settings']);
    
    if (result.settings) {
      console.log('📋 [POPUP] Loaded settings from storage:', result.settings);
    } else {
      console.log('⚠️ [POPUP] No settings found in storage, using defaults');
    }
    
    const settings = result.settings || {
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
    
    console.log('🔄 [POPUP] Final settings to use:', {
      provider: settings.provider,
      openRouterModel: settings.openRouterModel,
      openaiModel: settings.openaiModel,
      deepseekModel: settings.deepseekModel,
      claudeModel: settings.claudeModel
    });
    
    // Populate form fields
    document.getElementById('minWords').value = settings.minWords;
    document.getElementById('maxWords').value = settings.maxWords;
    document.getElementById('defaultText').value = settings.defaultText;
    document.getElementById('includeEmoji').checked = settings.includeEmoji;
    
    // Set tone radio button
    const toneRadio = document.querySelector(`input[name="tone"][value="${settings.tone}"]`);
    if (toneRadio) {
      toneRadio.checked = true;
      updateToneSelection(settings.tone);
    }
    
    document.getElementById('delayRange').value = settings.delayRange;
    document.getElementById('typingSpeed').value = settings.typingSpeed;
    
    // Populate UI with settings
    populateUIWithSettings(settings);
  } catch (error) {
    console.error('❌ [POPUP] Error loading settings:', error);
    showStatus('Failed to load settings', 'error');
  }
}

// Populate UI with settings data
function populateUIWithSettings(settings) {
  // Populate form fields
  document.getElementById('minWords').value = settings.minWords;
  document.getElementById('maxWords').value = settings.maxWords;
  document.getElementById('defaultText').value = settings.defaultText;
  document.getElementById('includeEmoji').checked = settings.includeEmoji;
  
  // Set tone radio button
  const toneRadio = document.querySelector(`input[name="tone"][value="${settings.tone}"]`);
  if (toneRadio) {
    toneRadio.checked = true;
    updateToneSelection(settings.tone);
  }
  
  document.getElementById('delayRange').value = settings.delayRange;
  document.getElementById('typingSpeed').value = settings.typingSpeed;
  
  // Populate settings tab fields
  document.getElementById('provider').value = settings.provider;
  document.getElementById('geminiApiKey').value = settings.geminiKey || '';
  document.getElementById('openRouterApiKey').value = settings.openRouterKey || '';
  document.getElementById('openaiApiKey').value = settings.openaiKey || '';
  document.getElementById('deepseekApiKey').value = settings.deepseekKey || '';
  document.getElementById('claudeApiKey').value = settings.claudeKey || '';
  
  // Populate model selections
  document.getElementById('openRouterModel').value = settings.openRouterModel;
  document.getElementById('openRouterCustomModelName').value = settings.openRouterCustomModelName || '';
  document.getElementById('openaiModel').value = settings.openaiModel;
  document.getElementById('openaiCustomModelName').value = settings.openaiCustomModelName || '';
  document.getElementById('deepseekModel').value = settings.deepseekModel;
  document.getElementById('claudeModel').value = settings.claudeModel;
  document.getElementById('claudeCustomModelName').value = settings.claudeCustomModelName || '';
  
  // Update UI based on provider
  updateProviderUI(settings.provider);
  updateProviderPill(settings.provider);
  updateModelInfo(settings);
  updateExtensionStatus(settings.enabled);
  
  // Update custom model group visibility
  updateCustomModelVisibility();
  
  updateRangePreview();
}

// Setup event listeners
function setupEventListeners() {
  // Save buttons
  document.getElementById('saveBtn').addEventListener('click', saveGenerateSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveProviderSettings);
  
  // Toggle API key visibility
  document.getElementById('toggleGeminiKey').addEventListener('click', () => toggleKeyVisibility('geminiApiKey', 'toggleGeminiKey'));
  document.getElementById('toggleOpenRouterKey').addEventListener('click', () => toggleKeyVisibility('openRouterApiKey', 'toggleOpenRouterKey'));
  document.getElementById('toggleOpenaiKey').addEventListener('click', () => toggleKeyVisibility('openaiApiKey', 'toggleOpenaiKey'));
  document.getElementById('toggleDeepseekKey').addEventListener('click', () => toggleKeyVisibility('deepseekApiKey', 'toggleDeepseekKey'));
  document.getElementById('toggleClaudeKey').addEventListener('click', () => toggleKeyVisibility('claudeApiKey', 'toggleClaudeKey'));
  
  // Update range preview
  document.getElementById('minWords').addEventListener('input', updateRangePreview);
  document.getElementById('maxWords').addEventListener('input', updateRangePreview);
  
  // Provider dropdown change
  document.getElementById('provider').addEventListener('change', async (e) => {
    const provider = e.target.value;
    updateProviderUI(provider);
    updateProviderPill(provider);
    
    // Clear custom model fields when switching providers
    clearCustomModelFields();
    
    // Load current settings to get model info
    try {
      const result = await chrome.storage.local.get(['settings']);
      const settings = result.settings || {};
      settings.provider = provider; // Update with new provider
      updateModelInfo(settings);
    } catch (error) {
      console.error('Failed to update model info:', error);
    }
  });
  
  // Model selection change handlers
  document.getElementById('openRouterModel').addEventListener('change', () => updateCustomModelVisibility('openrouter'));
  document.getElementById('openaiModel').addEventListener('change', () => updateCustomModelVisibility('openai'));
  document.getElementById('deepseekModel').addEventListener('change', () => updateCustomModelVisibility('deepseek'));
  document.getElementById('claudeModel').addEventListener('change', () => updateCustomModelVisibility('claude'));
  
  // API key input handlers to show model selection
  document.getElementById('openRouterApiKey').addEventListener('input', () => handleApiKeyInput('openrouter'));
  document.getElementById('openaiApiKey').addEventListener('input', () => handleApiKeyInput('openai'));
  document.getElementById('deepseekApiKey').addEventListener('input', () => handleApiKeyInput('deepseek'));
  document.getElementById('claudeApiKey').addEventListener('input', () => handleApiKeyInput('claude'));
  
  // Enter key saves settings
  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      const activeTab = document.querySelector('.tab-content.active');
      if (activeTab && activeTab.id === 'generateContent') {
        saveGenerateSettings();
      } else if (activeTab && activeTab.id === 'settingsContent') {
        saveProviderSettings();
      }
    }
  });
  
  // Help links
  document.getElementById('geminiHelpLink').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: 'https://makersuite.google.com/app/apikey' });
  });
}

// Setup tab switching
function setupTabSwitching() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Remove active class from all tabs and contents
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab and corresponding content
      button.classList.add('active');
      document.getElementById(targetTab + 'Content').classList.add('active');
    });
  });
}

// Update provider UI visibility
function updateProviderUI(provider) {
  const keyGroups = {
    'gemini': document.getElementById('geminiKeyGroup'),
    'openrouter': document.getElementById('openRouterKeyGroup'),
    'openai': document.getElementById('openaiKeyGroup'),
    'deepseek': document.getElementById('deepseekKeyGroup'),
    'claude': document.getElementById('claudeKeyGroup')
  };
  
  const modelGroups = {
    'openrouter': document.getElementById('openRouterModelGroup'),
    'openai': document.getElementById('openaiModelGroup'),
    'deepseek': document.getElementById('deepseekModelGroup'),
    'claude': document.getElementById('claudeModelGroup')
  };
  
  const customModelGroups = {
    'openrouter': document.getElementById('openRouterCustomModelGroup'),
    'openai': document.getElementById('openaiCustomModelGroup'),
    'claude': document.getElementById('claudeCustomModelGroup')
  };
  
  // Hide all groups first
  Object.values(keyGroups).forEach(group => {
    if (group) group.style.display = 'none';
  });
  
  Object.values(modelGroups).forEach(group => {
    if (group) group.style.display = 'none';
  });
  
  Object.values(customModelGroups).forEach(group => {
    if (group) group.style.display = 'none';
  });
  
  // Show the selected provider's key group
  if (keyGroups[provider]) {
    keyGroups[provider].style.display = 'block';
  }
  
  // Show model selection for providers that support it
  if (modelGroups[provider]) {
    // Only show model selection if API key is valid
    const apiKeyInput = getApiKeyInputForProvider(provider);
    if (apiKeyInput && apiKeyInput.value.trim()) {
      modelGroups[provider].style.display = 'block';
      // Update custom model visibility based on current selection
      updateCustomModelVisibility(provider);
    }
  }
}

// Helper function to get API key input for provider
function getApiKeyInputForProvider(provider) {
  const inputs = {
    'gemini': document.getElementById('geminiApiKey'),
    'openrouter': document.getElementById('openRouterApiKey'),
    'openai': document.getElementById('openaiApiKey'),
    'deepseek': document.getElementById('deepseekApiKey'),
    'claude': document.getElementById('claudeApiKey')
  };
  return inputs[provider];
}

// Handle API key input to show/hide model selection
function handleApiKeyInput(provider) {
  const apiKeyInput = getApiKeyInputForProvider(provider);
  const modelGroups = {
    'openrouter': document.getElementById('openRouterModelGroup'),
    'openai': document.getElementById('openaiModelGroup'),
    'deepseek': document.getElementById('deepseekModelGroup'),
    'claude': document.getElementById('claudeModelGroup')
  };
  
  if (apiKeyInput && modelGroups[provider]) {
    const apiKey = apiKeyInput.value.trim();
    
    // Show model selection if API key looks valid (basic validation)
    if (isApiKeyFormatValid(provider, apiKey)) {
      modelGroups[provider].style.display = 'block';
      updateCustomModelVisibility(provider);
    } else {
      modelGroups[provider].style.display = 'none';
    }
  }
}

// Basic API key format validation
function isApiKeyFormatValid(provider, apiKey) {
  if (!apiKey || apiKey.length < 10) return false;
  
  switch (provider) {
    case 'openrouter':
      return apiKey.startsWith('sk-or-');
    case 'openai':
      return apiKey.startsWith('sk-');
    case 'deepseek':
      return apiKey.startsWith('sk-');
    case 'claude':
      return apiKey.startsWith('sk-ant-');
    default:
      return false;
  }
}

// Update provider pill
function updateProviderPill(provider) {
  const pill = document.getElementById('providerPill');
  const providerNames = {
    'gemini': 'Gemini',
    'openrouter': 'OpenRouter',
    'openai': 'OpenAI',
    'deepseek': 'DeepSeek',
    'claude': 'Claude'
  };
  
  const displayName = providerNames[provider] || provider;
  pill.textContent = `Using: ${displayName}`;
}

// Update model information display
function updateModelInfo(settings) {
  const modelInfo = document.getElementById('modelInfo');
  const provider = settings.provider;
  
  let modelName = '';
  switch (provider) {
    case 'gemini':
      modelName = 'gemini-2.0-flash';
      break;
    case 'openrouter':
      modelName = settings.openRouterModel === 'custom' ? 
        (settings.openRouterCustomModelName || 'custom model') : 
        settings.openRouterModel;
      break;
    case 'openai':
      modelName = settings.openaiModel === 'custom' ? 
        (settings.openaiCustomModelName || 'custom model') : 
        (settings.openaiModel || 'gpt-4o');
      break;
    case 'deepseek':
      modelName = settings.deepseekModel || 'deepseek-chat';
      break;
    case 'claude':
      modelName = settings.claudeModel === 'custom' ? 
        (settings.claudeCustomModelName || 'custom model') : 
        (settings.claudeModel || 'claude-opus-4-20250514');
      break;
    default:
      modelName = 'default';
  }
  
  modelInfo.textContent = `Model: ${modelName}`;
}

// Update extension status display
function updateExtensionStatus(enabled) {
  const statusIndicator = document.getElementById('statusIndicator');
  const statusLabel = document.getElementById('statusLabel');
  
  if (enabled) {
    statusIndicator.className = 'status-indicator active';
    statusLabel.textContent = 'Active';
  } else {
    statusIndicator.className = 'status-indicator inactive';
    statusLabel.textContent = 'Inactive';
  }
}

function updateCustomModelVisibility(provider) {
  const modelSelects = {
    'openrouter': document.getElementById('openRouterModel'),
    'openai': document.getElementById('openaiModel'),
    'deepseek': document.getElementById('deepseekModel'),
    'claude': document.getElementById('claudeModel')
  };
  
  const customModelGroups = {
    'openrouter': document.getElementById('openRouterCustomModelGroup'),
    'openai': document.getElementById('openaiCustomModelGroup'),
    'deepseek': document.getElementById('deepseekCustomModelGroup'),
    'claude': document.getElementById('claudeCustomModelGroup')
  };
  
  if (!provider) {
    // If no provider specified, update all
    Object.keys(modelSelects).forEach(p => updateCustomModelVisibility(p));
    return;
  }
  
  const modelSelect = modelSelects[provider];
  const customModelGroup = customModelGroups[provider];
  
  if (modelSelect && customModelGroup) {
    if (modelSelect.value === 'custom') {
      customModelGroup.style.display = 'block';
    } else {
      customModelGroup.style.display = 'none';
    }
  }
}

// Clear custom model fields when switching providers
function clearCustomModelFields() {
  const customModelInputs = [
    'openRouterCustomModelName',
    'openaiCustomModelName',
    'claudeCustomModelName'
  ];
  
  customModelInputs.forEach(inputId => {
    const input = document.getElementById(inputId);
    if (input) {
      input.value = '';
    }
  });
  
  console.log('🧹 [POPUP] Cleared custom model fields');
}

// Save generate tab settings
async function saveGenerateSettings() {
  const saveBtn = document.getElementById('saveBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    // Validate inputs
    const minWords = parseInt(document.getElementById('minWords').value);
    const maxWords = parseInt(document.getElementById('maxWords').value);
    
    if (minWords < 5 || minWords > 50) {
      throw new Error('Minimum words must be between 5 and 50');
    }
    
    if (maxWords < 10 || maxWords > 100) {
      throw new Error('Maximum words must be between 10 and 100');
    }
    
    if (minWords >= maxWords) {
      throw new Error('Maximum words must be greater than minimum words');
    }
    
    // Get current settings
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {};
    
    // Update only generate tab fields
    settings.minWords = minWords;
    settings.maxWords = maxWords;
    settings.defaultText = document.getElementById('defaultText').value.trim();
    settings.includeEmoji = document.getElementById('includeEmoji').checked;
    
    // Get selected tone
    const selectedTone = document.querySelector('input[name="tone"]:checked');
    settings.tone = selectedTone ? selectedTone.value : 'casual';
    
    settings.delayRange = document.getElementById('delayRange').value;
    settings.typingSpeed = document.getElementById('typingSpeed').value;
    
    // Check if at least one API key exists
    const hasAnyApiKey = settings.geminiKey || settings.openRouterKey || settings.openaiKey || settings.deepseekKey || settings.claudeKey;
    if (!hasAnyApiKey) {
      throw new Error('Please configure at least one API key in the Settings tab');
    }
    
    // Save to storage
    await chrome.storage.local.set({ settings });
    
    // Notify content scripts
    try {
      const tabs = await chrome.tabs.query({ url: ['https://twitter.com/*', 'https://x.com/*'] });
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { action: 'settingsUpdated', settings })
          .catch(() => {}); // Ignore errors for inactive tabs
      });
    } catch (error) {
      console.warn('Failed to notify tabs:', error);
    }
    
    showStatus('Settings saved successfully!', 'success');
  } catch (error) {
    showStatus(error.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Settings';
  }
}

// Save provider settings
async function saveProviderSettings() {
  const saveBtn = document.getElementById('saveSettingsBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    const provider = document.getElementById('provider').value;
    const apiKeys = {
      geminiKey: document.getElementById('geminiApiKey').value.trim(),
      openRouterKey: document.getElementById('openRouterApiKey').value.trim(),
      openaiKey: document.getElementById('openaiApiKey').value.trim(),
      deepseekKey: document.getElementById('deepseekApiKey').value.trim(),
      claudeKey: document.getElementById('claudeApiKey').value.trim()
    };
    
    // Get model selections
    const modelSettings = {
      openRouterModel: document.getElementById('openRouterModel').value,
      openRouterCustomModelName: document.getElementById('openRouterCustomModelName').value.trim(),
      openaiModel: document.getElementById('openaiModel').value,
      openaiCustomModelName: document.getElementById('openaiCustomModelName').value.trim(),
      deepseekModel: document.getElementById('deepseekModel').value,
      claudeModel: document.getElementById('claudeModel').value,
      claudeCustomModelName: document.getElementById('claudeCustomModelName').value.trim()
    };
    
    console.log('🔧 [POPUP] Saving provider settings:', {
      provider,
      modelSettings,
      timestamp: new Date().toISOString()
    });
    
    // Validate that at least one key is provided
    const hasAnyKey = Object.values(apiKeys).some(key => key.length > 0);
    if (!hasAnyKey) {
      throw new Error('Please provide at least one API key');
    }
    
    // Validate the active provider's key
    const getApiKeyName = (provider) => {
      const keyMap = {
        'gemini': 'geminiKey',
        'openrouter': 'openRouterKey',
        'openai': 'openaiKey',
        'deepseek': 'deepseekKey',
        'claude': 'claudeKey'
      };
      return keyMap[provider];
    };
    
    const currentProviderKey = apiKeys[getApiKeyName(provider)];
    if (!currentProviderKey) {
      throw new Error(`${getProviderDisplayName(provider)} API key is required when ${getProviderDisplayName(provider)} is selected`);
    }
    
    // Validate custom model names if custom models are selected
    if (provider === 'openrouter' && modelSettings.openRouterModel === 'custom' && !modelSettings.openRouterCustomModelName) {
      throw new Error('Custom model name is required when Custom Model is selected');
    }
    if (provider === 'openai' && modelSettings.openaiModel === 'custom' && !modelSettings.openaiCustomModelName) {
      throw new Error('Custom model name is required when Custom Model is selected');
    }

    if (provider === 'claude' && modelSettings.claudeModel === 'custom' && !modelSettings.claudeCustomModelName) {
      throw new Error('Custom model name is required when Custom Model is selected');
    }
    
    // Validate API key formats
    await validateApiKeyFormat(provider, currentProviderKey);
    
    // Get current settings
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || {
      enabled: true,
      minWords: 5,
      maxWords: 16,
      defaultText: '',
      includeEmoji: true,
      delayRange: '3-8',
      typingSpeed: 'normal'
    };
    
    // Update provider settings
    settings.provider = provider;
    Object.assign(settings, apiKeys);
    Object.assign(settings, modelSettings);
    
    console.log('💾 [POPUP] Saving to chrome.storage.local:', settings);
    
    // Save to storage
    await chrome.storage.local.set({ settings });
    
    // Verify the save by reading back from storage
    const savedSettings = await chrome.storage.local.get(['settings']);
    console.log('✅ [POPUP] Verified saved settings:', savedSettings.settings);
    
    // Update UI
    updateProviderPill(provider);
    updateModelInfo(settings);
    
    // Notify content scripts
    try {
      const tabs = await chrome.tabs.query({ url: ['https://twitter.com/*', 'https://x.com/*'] });
      console.log(`📢 [POPUP] Notifying ${tabs.length} tabs about provider settings change`);
      
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'providerSettingsUpdated', 
          settings: settings
        }).catch(() => {});
      });
    } catch (error) {
      console.warn('Failed to notify tabs:', error);
    }
    
    showSettingsStatus('Provider settings saved successfully!', 'success');
  } catch (error) {
    console.error('❌ [POPUP] Error saving provider settings:', error);
    showSettingsStatus(error.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fas fa-save"></i> Save Settings';
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

// Validate API key format
async function validateApiKeyFormat(provider, apiKey) {
  if (!apiKey || apiKey.length < 10) {
    throw new Error(`${getProviderDisplayName(provider)} API key appears to be too short`);
  }
  
  switch (provider) {
    case 'gemini':
      if (!apiKey.startsWith('AIza')) {
        throw new Error('Gemini API key should start with "AIza"');
      }
      break;
    case 'openrouter':
      if (!apiKey.startsWith('sk-or-')) {
        throw new Error('OpenRouter API key should start with "sk-or-"');
      }
      break;
    case 'openai':
      if (!apiKey.startsWith('sk-')) {
        throw new Error('OpenAI API key should start with "sk-"');
      }
      if (apiKey.length < 40) {
        throw new Error('OpenAI API key appears to be too short');
      }
      break;
    case 'deepseek':
      if (!apiKey.startsWith('sk-')) {
        throw new Error('DeepSeek API key should start with "sk-"');
      }
      break;
    case 'claude':
      if (!apiKey.startsWith('sk-ant-')) {
        throw new Error('Claude API key should start with "sk-ant-"');
      }
      if (apiKey.length < 40) {
        throw new Error('Claude API key appears to be too short');
      }
      break;
  }
}



// Generic toggle key visibility function
function toggleKeyVisibility(inputId, buttonId) {
  const apiKeyInput = document.getElementById(inputId);
  const toggleBtn = document.getElementById(buttonId);
  const icon = toggleBtn.querySelector('i');
  
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    apiKeyInput.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

// Update range preview
function updateRangePreview() {
  const min = document.getElementById('minWords').value;
  const max = document.getElementById('maxWords').value;
  document.getElementById('rangePreview').textContent = `${min}-${max} words`;
}

// Show status message
function showStatus(message, type) {
  const statusEl = document.getElementById('statusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  
  setTimeout(() => {
    statusEl.className = 'status-message';
  }, 3000);
}

// Show settings status message
function showSettingsStatus(message, type) {
  const statusEl = document.getElementById('settingsStatusMessage');
  statusEl.textContent = message;
  statusEl.className = `status-message ${type}`;
  
  setTimeout(() => {
    statusEl.className = 'status-message';
  }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + S to save
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab && activeTab.id === 'generateContent') {
      saveGenerateSettings();
    } else if (activeTab && activeTab.id === 'settingsContent') {
      saveProviderSettings();
    }
  }
  
  // Ctrl/Cmd + R to reset (with confirmation)
  if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
    e.preventDefault();
    if (confirm('Reset all settings to defaults?')) {
      resetSettings();
    }
  }
});

// Reset settings to defaults
async function resetSettings() {
  try {
    await chrome.storage.local.remove(['settings']);
    await loadSettings();
    showStatus('Settings reset to defaults', 'success');
  } catch (error) {
    showStatus('Failed to reset settings', 'error');
  }
}

// Update tone selection visual state
function updateToneSelection(selectedTone) {
  document.querySelectorAll('.tone-option').forEach(option => {
    option.classList.remove('checked');
  });
  
  const selectedOption = document.querySelector(`input[name="tone"][value="${selectedTone}"]`)?.closest('.tone-option');
  if (selectedOption) {
    selectedOption.classList.add('checked');
  }
}

// Add tone selection event listeners
document.querySelectorAll('input[name="tone"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    updateToneSelection(e.target.value);
  });
});

// Handle window focus for real-time updates
window.addEventListener('focus', () => {
  loadSettings();
});

// Handle extension updates
if (chrome && chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'settingsChanged') {
      loadSettings();
    }
  });
}