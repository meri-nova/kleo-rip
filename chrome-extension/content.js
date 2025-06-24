// Content script for LinkedIn profile pages
(function() {
  'use strict';

  // Check if we're on a LinkedIn profile page
  function isLinkedInProfile() {
    return window.location.href.includes('/in/') && 
           (window.location.hostname === 'linkedin.com' || 
            window.location.hostname.endsWith('.linkedin.com'));
  }

  // Extract profile URL
  function getProfileUrl() {
    const url = window.location.href;
    // Clean up the URL to get the base profile URL
    const match = url.match(/https:\/\/[^\/]+\/in\/[^\/\?]+/);
    return match ? match[0] : url;
  }

  // Extract profile information
  function getProfileInfo() {
    const profileUrl = getProfileUrl();
    
    // Try to get profile name
    let fullName = '';
    const nameElement = document.querySelector('h1.text-heading-xlarge') || 
                       document.querySelector('.pv-text-details__left-panel h1') ||
                       document.querySelector('.ph5 h1');
    if (nameElement) {
      fullName = nameElement.textContent.trim();
    }

    // Try to get profile image
    let profileImageUrl = '';
    const imgElement = document.querySelector('.pv-top-card-profile-picture__image') ||
                      document.querySelector('.profile-photo-edit__preview') ||
                      document.querySelector('img[data-anonymize="headshot"]');
    if (imgElement) {
      profileImageUrl = imgElement.src;
    }

    return {
      profileUrl,
      fullName,
      profileImageUrl,
      username: profileUrl.split('/in/')[1]?.split('/')[0] || ''
    };
  }

  // Create and inject the scrape button
  function createScrapeButton() {
    // Check if button already exists
    if (document.getElementById('linkedin-scraper-btn')) {
      return;
    }

    const button = document.createElement('button');
    button.id = 'linkedin-scraper-btn';
    button.innerHTML = '📊 Scrape Posts';
    button.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      background: #0073b1;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 24px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,115,177,0.3);
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.background = '#005582';
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 16px rgba(0,115,177,0.4)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#0073b1';
      button.style.transform = 'translateY(0)';
      button.style.boxShadow = '0 4px 12px rgba(0,115,177,0.3)';
    });

    // Click handler
    button.addEventListener('click', handleScrapeClick);

    document.body.appendChild(button);
  }

  // Handle scrape button click
  function handleScrapeClick() {
    const profileInfo = getProfileInfo();
    
    // Send message to background script
    chrome.runtime.sendMessage({
      action: 'scrapeProfile',
      profileInfo: profileInfo
    }, (response) => {
      if (response && response.success) {
        // Update button to show success
        const button = document.getElementById('linkedin-scraper-btn');
        if (button) {
          button.innerHTML = '✅ Opening Dashboard...';
          button.style.background = '#28a745';
        }
      }
    });
  }

  // Initialize when page loads
  function init() {
    if (isLinkedInProfile()) {
      // Wait a bit for page to fully load
      setTimeout(() => {
        createScrapeButton();
      }, 2000);
    }
  }

  // Handle navigation changes in single-page app
  let currentUrl = window.location.href;
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
      currentUrl = window.location.href;
      
      // Remove existing button
      const existingButton = document.getElementById('linkedin-scraper-btn');
      if (existingButton) {
        existingButton.remove();
      }
      
      // Add button if on profile page
      if (isLinkedInProfile()) {
        setTimeout(createScrapeButton, 2000);
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();