document.addEventListener('DOMContentLoaded', async () => {
  const currentPageEl = document.getElementById('currentPage');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const statusEl = document.getElementById('status');
  const recentProfilesEl = document.getElementById('recentProfiles');

  let currentTab = null;
  let isLinkedInProfile = false;

  // Get current tab
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab;
    
    // Check if current tab is a LinkedIn profile
    if (tab.url && tab.url.includes('linkedin.com/in/')) {
      isLinkedInProfile = true;
      currentPageEl.textContent = 'LinkedIn profile detected';
      scrapeBtn.disabled = false;
      scrapeBtn.textContent = 'Scrape This Profile';
    } else {
      currentPageEl.textContent = 'Navigate to a LinkedIn profile to scrape posts';
      scrapeBtn.textContent = 'Open Dashboard';
      scrapeBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error getting current tab:', error);
    currentPageEl.textContent = 'Unable to detect current page';
  }

  // Load recent profiles
  loadRecentProfiles();

  // Handle scrape button click
  scrapeBtn.addEventListener('click', async () => {
    if (!isLinkedInProfile) {
      // Open general dashboard
      chrome.tabs.create({
        url: 'http://localhost:3000/dashboard',
        active: true
      });
      window.close();
      return;
    }

    try {
      scrapeBtn.disabled = true;
      scrapeBtn.textContent = 'Starting...';
      showStatus('Starting scrape process...', 'success');

      // Get profile info directly from the current tab URL
      const profileInfo = {
        profileUrl: currentTab.url.match(/https:\/\/[^\/]+\/in\/[^\/\?]+/)?.[0] || currentTab.url,
        fullName: '',
        username: currentTab.url.split('/in/')[1]?.split('/')[0] || '',
        profileImageUrl: ''
      };

      // Send directly to background script for processing
      chrome.runtime.sendMessage({
        action: 'scrapeProfile',
        profileInfo: profileInfo
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Background script error:', chrome.runtime.lastError);
          showStatus(`Error: ${chrome.runtime.lastError.message}`, 'error');
          scrapeBtn.disabled = false;
          scrapeBtn.textContent = 'Scrape This Profile';
          return;
        }
        
        if (response && response.success) {
          showStatus('Dashboard opened! Scraping in progress...', 'success');
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          showStatus(`Error: ${response?.error || 'Unknown error'}`, 'error');
          scrapeBtn.disabled = false;
          scrapeBtn.textContent = 'Scrape This Profile';
        }
      });

    } catch (error) {
      console.error('Scrape error:', error);
      showStatus(`Error: ${error.message}`, 'error');
      scrapeBtn.disabled = false;
      scrapeBtn.textContent = 'Scrape This Profile';
    }
  });

  // Load and display recent profiles
  async function loadRecentProfiles() {
    try {
      const storage = await chrome.storage.local.get();
      const profiles = [];

      for (const [key, value] of Object.entries(storage)) {
        if (key.startsWith('profile_')) {
          profiles.push(value);
        }
      }

      // Sort by last accessed
      profiles.sort((a, b) => b.lastAccessed - a.lastAccessed);

      if (profiles.length === 0) {
        recentProfilesEl.innerHTML = '<div class="empty-state">No recent profiles</div>';
        return;
      }

      // Display profiles
      recentProfilesEl.innerHTML = profiles.slice(0, 5).map(profile => `
        <div class="profile-item">
          <div>
            <div class="profile-name">${profile.fullName || 'Unknown'}</div>
            <div class="profile-username">${profile.username}</div>
          </div>
          <button class="view-btn" onclick="openProfile('${profile.profileUrl}')">
            View
          </button>
        </div>
      `).join('');

    } catch (error) {
      console.error('Error loading recent profiles:', error);
    }
  }

  // Show status message
  function showStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
    statusEl.style.display = 'block';
  }

  // Make openProfile available globally
  window.openProfile = function(profileUrl) {
    const dashboardUrl = `http://localhost:3000/dashboard?profile=${encodeURIComponent(profileUrl)}`;
    chrome.tabs.create({
      url: dashboardUrl,
      active: true
    });
    window.close();
  };
});

// Function to inject into page
function triggerScrapeFromPopup() {
  // This function runs in the context of the web page
  const event = new CustomEvent('scrapeProfile');
  document.dispatchEvent(event);
  
  return {
    profileInfo: {
      profileUrl: window.location.href.match(/https:\/\/[^\/]+\/in\/[^\/\?]+/)?.[0] || window.location.href,
      fullName: document.querySelector('h1.text-heading-xlarge')?.textContent?.trim() || '',
      username: window.location.href.split('/in/')[1]?.split('/')[0] || '',
      profileImageUrl: document.querySelector('.pv-top-card-profile-picture__image')?.src || ''
    }
  };
}