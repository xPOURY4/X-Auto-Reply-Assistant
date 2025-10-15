# Model Selection Persistence Test Instructions

## Overview
These instructions will help you verify that the model selection persistence issue has been resolved. The debugging logs added will help track model changes and confirm proper functionality.

## Prerequisites
1. Ensure the extension is loaded in Chrome
2. Open Chrome DevTools (F12) and go to the Console tab
3. Filter console logs by typing "BACKGROUND" or "POPUP" or "CONTENT" to see relevant debug messages

## Test Scenarios

### Test 1: Basic Model Selection Change
1. **Open Extension Popup**
   - Click the extension icon in Chrome toolbar
   - Go to "Settings" tab

2. **Change Provider and Model**
   - Select a different provider (e.g., from Gemini to OpenAI)
   - Select a different model for that provider
   - Click "Save Settings"
   - **Expected Console Logs:**
     ```
     💾 [POPUP] Saving provider settings...
     📋 [POPUP] Settings being saved to chrome.storage.local: {provider: "openai", openaiModel: "gpt-4", ...}
     ✅ [POPUP] Settings saved successfully to chrome.storage.local
     🔔 [POPUP] Notifying content scripts about settings change
     ```

3. **Verify Settings Persistence**
   - Close the popup
   - Reopen the popup
   - **Expected Console Logs:**
     ```
     📋 [POPUP] Loading settings from chrome.storage.local...
     ✅ [POPUP] Loaded settings: {provider: "openai", openaiModel: "gpt-4", ...}
     🔧 [POPUP] Using provider: openai, model: gpt-4
     ```
   - Verify the UI shows the correct provider and model selected

### Test 2: Extension Reload Persistence
1. **Change Model Settings**
   - Select a specific provider and model combination
   - Save settings
   - Note the exact provider/model combination

2. **Reload Extension**
   - Go to Chrome Extensions page (chrome://extensions/)
   - Find "X Auto Reply Assistant"
   - Click the reload button (🔄)

3. **Verify Persistence After Reload**
   - Open the extension popup
   - **Expected Console Logs:**
     ```
     📋 [POPUP] Loading settings from chrome.storage.local...
     ✅ [POPUP] Loaded settings: {provider: "...", ...Model: "...", ...}
     ```
   - Verify the UI shows the same provider and model that were selected before reload

### Test 3: Reply Generation with Correct Model
1. **Set Specific Model**
   - Choose a provider and model (e.g., OpenAI with GPT-4)
   - Save settings

2. **Generate a Reply**
   - Go to X.com (Twitter)
   - Find a tweet and click reply
   - Click the "Auto Reply" button in the extension
   - **Expected Console Logs:**
     ```
     📋 [CONTENT] Loading settings from chrome.storage.local...
     ✅ [CONTENT] Loaded settings - Provider: openai, Model: gpt-4
     🚀 [BACKGROUND] Starting reply generation...
     📋 [BACKGROUND] Loaded settings for reply generation: {provider: "openai", openaiModel: "gpt-4", ...}
     🔧 [BACKGROUND] Reply generation using provider: openai
     🤖 [BACKGROUND] Calling OpenAI API for reply with model: gpt-4
     ✅ [BACKGROUND] Successfully generated reply using openai/gpt-4
     ```

3. **Change Model and Test Again**
   - Change to a different provider/model
   - Generate another reply
   - Verify the console logs show the new provider/model being used

### Test 4: Tweet Generation with Correct Model
1. **Set Specific Model**
   - Choose a provider and model
   - Save settings

2. **Generate a Tweet**
   - Go to X.com (Twitter)
   - Click the compose tweet button
   - Use the extension's tweet generation feature
   - **Expected Console Logs:**
     ```
     🚀 [BACKGROUND] Starting tweet generation...
     📋 [BACKGROUND] Loaded settings for tweet generation: {provider: "...", ...Model: "...", ...}
     🔧 [BACKGROUND] Tweet generation using provider: ...
     🤖 [BACKGROUND] Calling ... API for tweet with model: ...
     ✅ [BACKGROUND] Successfully generated tweet using .../...
     ```

### Test 5: Settings Update Notification
1. **Open Multiple Tabs**
   - Have X.com open in one tab
   - Open extension popup in another tab

2. **Change Settings**
   - In the popup, change provider/model and save
   - **Expected Console Logs in X.com tab:**
     ```
     🔔 [CONTENT] Received settings update from popup
     📋 [CONTENT] Updated settings: {provider: "...", ...}
     🔄 [CONTENT] Provider changed from ... to ...
     🔄 [CONTENT] Model changed from ... to ...
     ```

## Troubleshooting

### If Model Selection Doesn't Persist:
- Check for error messages in console
- Verify chrome.storage.local permissions in manifest.json
- Look for failed save operations in popup logs

### If Wrong Model is Used:
- Check if settings are being loaded fresh in background.js
- Verify the provider/model mapping in the switch statements
- Look for caching issues in content.js

### If Settings Don't Update Across Tabs:
- Check if settingsUpdated messages are being sent
- Verify message listeners are properly set up
- Look for errors in the handleMessage function

## Success Criteria
✅ Model selection changes are immediately saved to chrome.storage.local  
✅ Settings persist across extension reloads  
✅ Reply generation uses the currently selected model  
✅ Tweet generation uses the currently selected model  
✅ Settings updates are propagated to all open tabs  
✅ Console logs clearly show which provider/model is being used for each operation  

## Notes
- All debug logs are prefixed with emojis and component names for easy identification
- Logs include timestamps for tracking the sequence of operations
- The logs will help identify exactly where any persistence issues occur