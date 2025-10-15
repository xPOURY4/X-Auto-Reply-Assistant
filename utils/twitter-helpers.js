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

// Twitter-specific helper functions

// Get current theme
function getTwitterTheme() {
  const isDark = document.documentElement.style.backgroundColor === 'rgb(0, 0, 0)' ||
                 document.body.style.backgroundColor === 'rgb(0, 0, 0)' ||
                 document.querySelector('[data-theme="dark"]') ||
                 document.documentElement.getAttribute('data-color-mode') === 'dark';
  return isDark ? 'dark' : 'light';
}

// Check if on mobile Twitter
function isMobileTwitter() {
  return window.location.hostname === 'mobile.twitter.com' ||
         window.innerWidth < 768 ||
         document.querySelector('meta[name="viewport"][content*="width=device-width"]');
}

// Check if on X Pro
function isXPro() {
  return window.location.hostname === 'pro.x.com';
}

// Get tweet ID from element
function getTweetId(tweetElement) {
  const statusLink = tweetElement.querySelector('a[href*="/status/"]');
  if (statusLink) {
    const match = statusLink.href.match(/\/status\/(\d+)/);
    return match ? match[1] : null;
  }
  
  // Fallback: try to get from parent elements
  let current = tweetElement;
  while (current && current !== document.body) {
    const href = current.querySelector('a[href*="/status/"]')?.href;
    if (href) {
      const match = href.match(/\/status\/(\d+)/);
      if (match) return match[1];
    }
    current = current.parentElement;
  }
  
  return null;
}

// Check if element is in viewport
function isInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// Detect tweet language
function detectTweetLanguage(tweetText) {
  if (!tweetText) return 'en';
  
  // Check each language pattern
  for (const [lang, pattern] of Object.entries(LANGUAGE_PATTERNS)) {
    if (pattern.test(tweetText)) {
      return lang;
    }
  }
  
  // Default to English
  return 'en';
}

// Get tweet author handle
function getTweetAuthor(tweetElement) {
  const authorLink = tweetElement.querySelector(SELECTORS.tweetAuthor);
  if (authorLink) {
    const href = authorLink.getAttribute('href');
    return href ? href.substring(1) : null; // Remove leading '/'
  }
  return null;
}

// Check if tweet is a reply
function isTweetReply(tweetElement) {
  const replyingTo = tweetElement.querySelector('div[dir] > span');
  return replyingTo && replyingTo.textContent.includes('Replying to');
}

// Check if tweet is part of a thread
function isTweetThread(tweetElement) {
  return !!tweetElement.querySelector(SELECTORS.threadLine) ||
         !!tweetElement.querySelector('[data-testid="tweet"] + [data-testid="tweet"]');
}

// Get tweet timestamp
function getTweetTimestamp(tweetElement) {
  const timeElement = tweetElement.querySelector(SELECTORS.tweetTime);
  return timeElement ? timeElement.getAttribute('datetime') : null;
}

// Extract mentions from tweet
function extractMentions(tweetElement) {
  const mentions = [];
  const textElement = tweetElement.querySelector(SELECTORS.tweetText);
  
  if (textElement) {
    const mentionLinks = textElement.querySelectorAll('a[href^="/"]');
    mentionLinks.forEach(link => {
      const text = link.textContent;
      if (text.startsWith('@')) {
        mentions.push(text);
      }
    });
  }
  
  return mentions;
}

// Extract hashtags from tweet
function extractHashtags(tweetElement) {
  const hashtags = [];
  const textElement = tweetElement.querySelector(SELECTORS.tweetText);
  
  if (textElement) {
    const hashtagLinks = textElement.querySelectorAll('a[href*="/hashtag/"]');
    hashtagLinks.forEach(link => {
      hashtags.push(link.textContent);
    });
  }
  
  return hashtags;
}

// Check if tweet has media content
function tweetHasMedia(tweetElement) {
  return !!(
    tweetElement.querySelector(SELECTORS.tweetPhoto) ||
    tweetElement.querySelector(SELECTORS.tweetVideo) ||
    tweetElement.querySelector(SELECTORS.tweetPoll) ||
    tweetElement.querySelector(SELECTORS.quoteTweet)
  );
}

// Get engagement metrics
function getTweetEngagement(tweetElement) {
  const engagement = {
    replies: 0,
    retweets: 0,
    likes: 0
  };
  
  // Extract reply count
  const replyButton = tweetElement.querySelector(SELECTORS.replyButton);
  if (replyButton) {
    const replyText = replyButton.textContent.trim();
    const replyMatch = replyText.match(/(\d+)/);
    if (replyMatch) engagement.replies = parseInt(replyMatch[1]);
  }
  
  // Extract retweet count
  const retweetButton = tweetElement.querySelector(SELECTORS.retweetButton);
  if (retweetButton) {
    const retweetText = retweetButton.textContent.trim();
    const retweetMatch = retweetText.match(/(\d+)/);
    if (retweetMatch) engagement.retweets = parseInt(retweetMatch[1]);
  }
  
  // Extract like count
  const likeButton = tweetElement.querySelector(SELECTORS.likeButton);
  if (likeButton) {
    const likeText = likeButton.textContent.trim();
    const likeMatch = likeText.match(/(\d+)/);
    if (likeMatch) engagement.likes = parseInt(likeMatch[1]);
  }
  
  return engagement;
}

// Classify tweet type based on content
function classifyTweetType(tweetText, tweetElement) {
  if (!tweetText) return TWEET_TYPES.PERSONAL;
  
  const text = tweetText.toLowerCase();
  const hasMedia = tweetHasMedia(tweetElement);
  const isThread = isTweetThread(tweetElement);
  
  // Question detection
  if (text.includes('?') || text.match(/\b(what|how|why|when|where|who|which)\b/)) {
    return TWEET_TYPES.QUESTION;
  }
  
  // News detection
  if (text.match(/\b(breaking|news|report|announced|confirms|statement)\b/) ||
      hasMedia && text.match(/\b(video|photo|image|live)\b/)) {
    return TWEET_TYPES.NEWS;
  }
  
  // Educational detection
  if (text.match(/\b(learn|tutorial|guide|tip|how to|explain|understand)\b/) ||
      isThread) {
    return TWEET_TYPES.EDUCATIONAL;
  }
  
  // Humor detection
  if (text.match(/\b(lol|haha|😂|😄|😆|funny|joke|hilarious)\b/)) {
    return TWEET_TYPES.HUMOR;
  }
  
  // Opinion detection
  if (text.match(/\b(think|believe|opinion|feel|should|must|agree|disagree)\b/)) {
    return TWEET_TYPES.OPINION;
  }
  
  // Promotional detection
  if (text.match(/\b(buy|sale|discount|offer|launch|new|check out|link in bio)\b/)) {
    return TWEET_TYPES.PROMOTIONAL;
  }
  
  // Default to personal
  return TWEET_TYPES.PERSONAL;
}

// Get clean tweet text (removes UI elements)
function getCleanTweetText(tweetElement) {
  const textElement = tweetElement.querySelector(SELECTORS.tweetText);
  if (!textElement) return '';
  
  let text = textElement.textContent.trim();
  
  // Remove "Show this thread" and similar UI text
  text = text.replace(/Show this thread$/i, '').trim();
  text = text.replace(/^Show this thread\s*/i, '').trim();
  text = text.replace(/Translate Tweet$/i, '').trim();
  text = text.replace(/^Translate Tweet\s*/i, '').trim();
  
  return text;
}

// Check if user is verified
function isVerifiedUser(tweetElement) {
  const verificationBadge = tweetElement.querySelector('[data-testid="icon-verified"]') ||
                           tweetElement.querySelector('[aria-label*="Verified"]') ||
                           tweetElement.querySelector('.verified');
  return !!verificationBadge;
}

// Get user follower count estimate (if visible)
function getUserFollowerEstimate(tweetElement) {
  // This would require additional API calls or parsing profile data
  // For now, return null as this info isn't readily available in tweet elements
  return null;
}

// Escape special characters for regex
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Generate unique identifier for tweet
function generateTweetIdentifier(tweetElement) {
  const tweetId = getTweetId(tweetElement);
  if (tweetId) return `tweet_${tweetId}`;
  
  // Fallback: use text hash and position
  const text = getCleanTweetText(tweetElement);
  const hash = simpleHash(text);
  const tweets = document.querySelectorAll(SELECTORS.tweetArticle);
  const index = Array.from(tweets).indexOf(tweetElement);
  
  return `tweet_${hash}_${index}`;
}

// Simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Check if current page is Twitter home timeline
function isTwitterTimeline() {
  return window.location.pathname === '/home' || 
         window.location.pathname === '/' ||
         window.location.pathname === '/timeline';
}

// Check if current page is a tweet detail page
function isTweetDetailPage() {
  return window.location.pathname.includes('/status/');
}

// Check if current page is a profile page
function isProfilePage() {
  return window.location.pathname.match(/^\/[^\/]+$/) && 
         !window.location.pathname.match(/^\/(home|explore|notifications|messages|bookmarks|lists|profile|settings)/);
}

// Get current page context
function getPageContext() {
  if (isTwitterTimeline()) return 'timeline';
  if (isTweetDetailPage()) return 'tweet_detail';
  if (isProfilePage()) return 'profile';
  return 'other';
}