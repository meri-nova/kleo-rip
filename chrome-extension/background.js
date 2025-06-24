// Background script for LinkedIn Post Scraper extension

const DASHBOARD_URL = 'http://localhost:3000/dashboard';
const API_BASE_URL = 'http://localhost:3000/api';

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrapeProfile') {
    handleScrapeProfile(message.profileInfo)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Keep message channel open for async response
  }
});

// Handle profile scraping
async function handleScrapeProfile(profileInfo) {
  try {
    console.log('Starting scrape for profile:', profileInfo);

    // Store profile info in extension storage
    await chrome.storage.local.set({
      [`profile_${profileInfo.username}`]: {
        ...profileInfo,
        lastAccessed: Date.now()
      }
    });

    // Start scraping process
    const scrapeResponse = await fetch(`${API_BASE_URL}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        linkedinUrl: profileInfo.profileUrl
      })
    });

    const scrapeData = await scrapeResponse.json();
    
    if (!scrapeResponse.ok) {
      throw new Error(scrapeData.error || 'Failed to start scraping');
    }

    // Build dashboard URL with parameters
    const dashboardParams = new URLSearchParams({
      profile: profileInfo.profileUrl
    });

    if (scrapeData.jobId) {
      dashboardParams.append('job', scrapeData.jobId);
    }

    const dashboardUrl = `${DASHBOARD_URL}?${dashboardParams.toString()}`;

    // Open dashboard in new tab
    const tab = await chrome.tabs.create({
      url: dashboardUrl,
      active: true
    });

    // Store the tab info for future reference
    await chrome.storage.local.set({
      lastDashboardTab: tab.id,
      lastScrapeJob: scrapeData.jobId || null
    });

    return {
      jobId: scrapeData.jobId,
      tabId: tab.id,
      dashboardUrl: dashboardUrl,
      cached: scrapeData.cached || false
    };

  } catch (error) {
    console.error('Scrape profile error:', error);
    
    // Show error notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'LinkedIn Scraper Error',
      message: error.message || 'Failed to scrape profile'
    });

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

// Clean up old stored data periodically
chrome.runtime.onInstalled.addListener(() => {
  // Set up periodic cleanup
  chrome.alarms.create('cleanup', { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'cleanup') {
    cleanupOldData();
  }
});

async function cleanupOldData() {
  try {
    const storage = await chrome.storage.local.get();
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

    const keysToRemove = [];
    for (const [key, value] of Object.entries(storage)) {
      if (key.startsWith('profile_') && value.lastAccessed < oneWeekAgo) {
        keysToRemove.push(key);
      }
    }

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} old profile entries`);
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}