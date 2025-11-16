// ═══════════════════════════════════════════════════════════════
// LINKEDIN POST SCRAPER - BACKGROUND SERVICE WORKER
// ═══════════════════════════════════════════════════════════════
// This background script acts as the "brain" of the extension.
// It handles communication between content.js and external APIs,
// manages data storage, and coordinates extension-wide actions.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════
// 1. CONFIGURATION & CONSTANTS
// ═══════════════════════════════════════════════
// Centralized configuration for API endpoints and URLs.
// Change these values to point to different environments (dev/prod).

const DASHBOARD_URL = 'https://kleo-rip.vercel.app/dashboard';
const API_BASE_URL = 'http://localhost:3000/api';


// ═══════════════════════════════════════════════
// 2. MESSAGE HANDLING (Communication Hub)
// ═══════════════════════════════════════════════
// This section listens for messages from content.js and popup.js.
// It acts as a router - receiving requests and directing them to
// the appropriate handler function.

/**
 * Main message listener - handles all incoming messages from content scripts
 * @param {Object} message - The message object containing action and data
 * @param {Object} sender - Information about the message sender
 * @param {Function} sendResponse - Callback function to send response back
 * @returns {boolean} - Returns true to keep message channel open for async responses
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  // Route message based on action type
  if (message.action === 'scrapeProfile') {
    // Handle profile scraping request
    handleScrapeProfile(message.profileInfo, message.posts)
      .then(result => {
        console.log('Scrape successful:', result);
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Scrape failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    // Keep message channel open for async response
    return true;
  }
  
  // Always return true to keep message channel open
  return true;
});


// ═══════════════════════════════════════════════
// 3. PROFILE SCRAPING & DATA PROCESSING
// ═══════════════════════════════════════════════
// This section handles the main scraping workflow:
// 1. Receive scraped data from content.js
// 2. Save profile info to Chrome storage
// 3. Send data to backend API
// 4. Open dashboard to view results

/**
 * Handle profile scraping with DOM-extracted posts
 * @param {Object} profileInfo - LinkedIn profile information (username, name, URL, image)
 * @param {Array} posts - Array of scraped post objects with content and engagement metrics
 * @returns {Promise<Object>} - Result object with posts count and save method
 */
async function handleScrapeProfile(profileInfo, posts = null) {
  try {
    console.log('Starting scrape for profile:', profileInfo);
    console.log('Posts extracted from DOM:', posts?.length || 0);

    // ─────────────────────────────────────────────
    // Step 1: Save profile info to Chrome storage
    // ─────────────────────────────────────────────
    // This allows us to track recently scraped profiles
    // and provide quick access to profile data
    await saveProfileToStorage(profileInfo);

    // ─────────────────────────────────────────────
    // Step 2: Send scraped posts to backend API
    // ─────────────────────────────────────────────
    // If we have DOM-extracted posts, send them to local API
    if (posts && posts.length > 0) {
      console.log(`🚀 Sending ${posts.length} posts to local API...`);
      
      const result = await sendPostsToAPI(profileInfo, posts);
      
      // ─────────────────────────────────────────────
      // Step 3: Open dashboard to view results
      // ─────────────────────────────────────────────
      await openDashboard(profileInfo.profileUrl);
      
      return result;
    } else {
      // No posts available - throw error
      throw new Error('No posts extracted from DOM. Please visit the LinkedIn activity page and try again.');
    }

  } catch (error) {
    console.error('Scrape profile error:', error);
    throw error;
  }
}


// ═══════════════════════════════════════════════
// 4. API COMMUNICATION
// ═══════════════════════════════════════════════
// This section handles all communication with the backend API.
// It sends scraped data to the server for storage and processing.

/**
 * Send scraped posts to backend API
 * @param {Object} profileInfo - Profile information
 * @param {Array} posts - Array of post objects
 * @returns {Promise<Object>} - API response with save confirmation
 */
async function sendPostsToAPI(profileInfo, posts) {
  console.log('API URL:', `${API_BASE_URL}/scrape-local`);
  console.log('Profile info:', profileInfo);
  console.log('First post sample:', posts[0]);

  // Make POST request to local API endpoint
  const response = await fetch(`${API_BASE_URL}/scrape-local`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      profileInfo: profileInfo,
      posts: posts
    })
  });

  console.log('📡 API Response status:', response.status);
  console.log('📡 API Response headers:', response.headers);

  const data = await response.json();
  console.log('📡 API Response data:', data);
  
  // Check if API call was successful
  if (!response.ok) {
    console.error('❌ API Error:', data);
    throw new Error(data.error || 'Failed to save extracted posts');
  }

  console.log('✅ Local API call successful!');
  console.log('📊 Posts saved to files:', data.postsCount);

  return {
    postsCount: data.postsCount,
    method: 'local-files',
    files: data.files,
    message: data.message
  };
}


// ═══════════════════════════════════════════════
// 5. CHROME STORAGE OPERATIONS
// ═══════════════════════════════════════════════
// This section manages data persistence using Chrome's storage API.
// Profile information is stored locally for quick access and history.

/**
 * Save profile information to Chrome local storage
 * @param {Object} profileInfo - Profile data to store
 */
async function saveProfileToStorage(profileInfo) {
  await chrome.storage.local.set({
    [`profile_${profileInfo.username}`]: {
      ...profileInfo,
      lastAccessed: Date.now()
    }
  });
}


// ═══════════════════════════════════════════════
// 6. NAVIGATION & TAB MANAGEMENT
// ═══════════════════════════════════════════════
// This section handles opening new tabs and navigating to dashboard.

/**
 * Open dashboard in new tab with profile URL parameter
 * @param {string} profileUrl - LinkedIn profile URL to pass to dashboard
 */
async function openDashboard(profileUrl) {
  const dashboardUrl = `${DASHBOARD_URL}?profile=${encodeURIComponent(profileUrl)}`;
  await chrome.tabs.create({
    url: dashboardUrl,
    active: true
  });
}


// ═══════════════════════════════════════════════
// 7. EXTENSION ACTIONS & ICON CLICKS
// ═══════════════════════════════════════════════
// This section handles what happens when user clicks the extension icon.
// Behavior changes based on whether user is on LinkedIn profile page.

/**
 * Handle extension icon click
 * - On LinkedIn profile: Inject content script
 * - On other pages: Open dashboard
 */
chrome.action.onClicked.addListener(async (tab) => {
  // Check if we're on a LinkedIn profile page
  if (tab.url && tab.url.includes('linkedin.com/in/')) {
    // Inject content script if not already present
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (error) {
      console.log('Content script already injected or failed to inject:', error);
    }
  } else {
    // Open general dashboard for other pages
    await chrome.tabs.create({
      url: DASHBOARD_URL,
      active: true
    });
  }
});


// ═══════════════════════════════════════════════
// 8. INITIALIZATION & LIFECYCLE
// ═══════════════════════════════════════════════
// This section runs when the extension is first installed or updated.

/**
 * Initialize extension on install
 * This runs once when extension is installed or updated
 */
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Post Scraper extension installed');
});
