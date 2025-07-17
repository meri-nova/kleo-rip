// Background script for LinkedIn Post Scraper extension

const DASHBOARD_URL = 'http://localhost:3000/dashboard';
const API_BASE_URL = 'http://localhost:3000/api';

// Handle messages from popup and content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background script received message:', message);
  
  if (message.action === 'scrapeProfile') {
    handleScrapeProfile(message.profileInfo, message.posts)
      .then(result => {
        console.log('Scrape successful:', result);
        sendResponse({ success: true, data: result });
      })
      .catch(error => {
        console.error('Scrape failed:', error);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep message channel open for async response
  }
  
  return true; // Always return true to keep message channel open
});

// Handle profile scraping with DOM-extracted posts
async function handleScrapeProfile(profileInfo, posts = null) {
  try {
    console.log('Starting scrape for profile:', profileInfo);
    console.log('Posts extracted from DOM:', posts?.length || 0);

    // Store profile info in extension storage
    await chrome.storage.local.set({
      [`profile_${profileInfo.username}`]: {
        ...profileInfo,
        lastAccessed: Date.now()
      }
    });

    // If we have DOM-extracted posts, send them directly to the API
    if (posts && posts.length > 0) {
      console.log(`🚀 Sending ${posts.length} posts to LOCAL API...`);
      console.log('API URL:', `${API_BASE_URL}/scrape-local`);
      console.log('Profile info:', profileInfo);
      console.log('First post sample:', posts[0]);

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
      
      if (!response.ok) {
        console.error('❌ API Error:', data);
        throw new Error(data.error || 'Failed to save extracted posts');
      }

      console.log('✅ Local API call successful!');
      console.log('📁 Files saved:', data.files);
      console.log('📊 Top posts:', data.topPosts);

      // For local testing, don't open dashboard, just show success
      console.log(`🎉 SUCCESS: ${data.postsCount} posts saved to local files!`);
      console.log(`📄 Profile file: ${data.files?.profile}`);
      console.log(`📄 Posts file: ${data.files?.posts}`);

      return {
        postsCount: posts.length,
        method: 'local-file-storage',
        files: data.files,
        topPosts: data.topPosts,
        message: data.message
      };
    } else {
      // No DOM posts available
      throw new Error('No posts extracted from DOM. Please visit the LinkedIn activity page and try again.');
    }

  } catch (error) {
    console.error('Scrape profile error:', error);
    throw error;
  }
}

// Handle extension icon click (when popup is not available)
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
    // Open general dashboard
    chrome.tabs.create({
      url: DASHBOARD_URL,
      active: true
    });
  }
});

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Post Scraper extension installed');
});