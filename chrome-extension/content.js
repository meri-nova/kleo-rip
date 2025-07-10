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

  // Extract posts from LinkedIn activity page
  function extractLinkedInPosts() {
    const posts = [];
    console.log('Starting DOM extraction of LinkedIn posts...');
    console.log('Current URL:', window.location.href);

    // Comprehensive selectors for LinkedIn posts across different layouts
    const postSelectors = [
      // Modern LinkedIn feed selectors
      '.feed-shared-update-v2',
      '.occludable-update', 
      '[data-urn*="activity"]',
      '.feed-shared-update-v2__content',
      'article[data-urn]',
      
      // Profile page specific selectors
      '.profile-creator-shared-feed-update__container',
      '.feed-shared-update-v2__content-wrapper',
      '.update-components-actor',
      
      // Activity page specific selectors  
      '.profile-creator-shared-feed-update',
      '.feed-shared-update-v2__wrapper',
      '.update-components-header',
      
      // Data attribute based selectors
      'div[data-id*="urn:li:activity"]',
      'div[data-urn*="urn:li:activity"]',
      '[data-urn*="ugcPost"]',
      '[data-urn*="activity:"]',
      
      // Container selectors
      '.social-activity-update',
      '.feed-shared-actor',
      '.update-components-update-v2',
      
      // Fallback selectors for different LinkedIn versions
      '.share-update-card',
      '.feed-shared-mini-update-v2',
      '.feed-shared-article',
      '.feed-shared-video',
      '.feed-shared-linkedinVideo',
      
      // Generic activity selectors
      '[class*="feed-shared-update"]',
      '[class*="update-components"]',
      '[data-test-id*="update"]',
      '[data-test-id*="feed"]'
    ];

    let postElements = [];
    
    // Try different selectors to find posts
    for (const selector of postSelectors) {
      postElements = document.querySelectorAll(selector);
      console.log(`Selector "${selector}": found ${postElements.length} elements`);
      if (postElements.length > 0) {
        console.log(`Found ${postElements.length} posts using selector: ${selector}`);
        break;
      }
    }

    if (postElements.length === 0) {
      console.log('No posts found with standard selectors, trying broader search...');
      // Fallback: look for elements that might contain posts
      postElements = document.querySelectorAll('div[class*="update"], div[class*="post"], div[class*="activity"], article, .artdeco-card');
      console.log(`Broader search found ${postElements.length} elements`);
    }

    // If still no posts, try even broader search
    if (postElements.length === 0) {
      console.log('Still no posts, trying very broad search...');
      postElements = document.querySelectorAll('[data-urn], [data-id*="activity"], .feed-shared-update-v2__content-wrapper');
      console.log(`Very broad search found ${postElements.length} elements`);
    }

    // Debug: log all class names of potential post elements
    if (postElements.length === 0) {
      console.log('No posts found. Debugging page structure...');
      
      // Check for different LinkedIn page layouts
      const pageType = window.location.href.includes('/recent-activity/') ? 'activity' : 'profile';
      console.log('Page type:', pageType);
      
      // Log common LinkedIn elements
      const feedContainer = document.querySelector('.core-rail, .scaffold-layout__main, .application-outlet');
      console.log('Feed container found:', !!feedContainer);
      
      // Look for any elements with 'activity' or 'post' related data attributes
      const dataElements = document.querySelectorAll('[data-urn], [data-id], [data-test-id]');
      console.log(`Found ${dataElements.length} elements with data attributes`);
      
      // Sample the data attributes to understand the page structure
      const sampleDataAttrs = Array.from(dataElements)
        .slice(0, 10)
        .map(el => ({
          tagName: el.tagName,
          dataUrn: el.getAttribute('data-urn'),
          dataId: el.getAttribute('data-id'),
          dataTestId: el.getAttribute('data-test-id'),
          className: el.className
        }))
        .filter(item => item.dataUrn || item.dataId || item.dataTestId);
      
      console.log('Sample data attributes:', sampleDataAttrs);
      
      // Look for elements with specific LinkedIn class patterns
      const linkedinElements = document.querySelectorAll('[class*="feed"], [class*="update"], [class*="post"], [class*="activity"]');
      console.log(`Found ${linkedinElements.length} LinkedIn-related elements`);
      
      if (linkedinElements.length > 0) {
        const sampleClasses = Array.from(linkedinElements)
          .slice(0, 5)
          .map(el => el.className)
          .filter(className => className.length < 200); // Avoid overly long class names
        console.log('Sample LinkedIn class names:', sampleClasses);
      }
    }

    postElements.forEach((postElement, index) => {
      try {
        const post = extractPostData(postElement, index);
        if (post && post.content && post.content.length > 50) {
          posts.push(post);
        }
      } catch (error) {
        console.error('Error extracting post:', error);
      }
    });

    console.log(`Extracted ${posts.length} posts from DOM`);
    return posts.slice(0, 20); // Limit to 20 posts max
  }

  // Extract data from a single post element
  function extractPostData(postElement, index) {
    const post = {
      content: '',
      likes: 0,
      comments: 0,
      reposts: 0,
      postDate: null,
      linkedinPostUrl: ''
    };

    // Extract post content with comprehensive selectors
    const contentSelectors = [
      // Primary content selectors
      '.feed-shared-text-view__text-content',
      '.feed-shared-text',
      '[data-test-id="main-feed-activity-card__commentary"]',
      '.feed-shared-update-v2__commentary .feed-shared-text',
      '.update-components-text span[dir="ltr"]',
      
      // Additional content selectors
      '.feed-shared-update-v2__description',
      '.update-components-text',
      '.feed-shared-update-v2__description-wrapper',
      '.update-components-text__text-view',
      '.feed-shared-text-view',
      '.update-components-linkedin-video__description',
      '.update-components-article__description',
      
      // Broader content selectors
      '.feed-shared-update-v2__commentary',
      '[data-test-id*="commentary"]',
      '[data-test-id*="description"]',
      '.update-components-update-v2 span[dir="ltr"]',
      
      // Fallback selectors
      '.social-details-social-activity__description',
      '.feed-shared-mini-update-v2__description-wrapper'
    ];

    for (const selector of contentSelectors) {
      const contentElement = postElement.querySelector(selector);
      if (contentElement) {
        post.content = contentElement.textContent?.trim() || '';
        if (post.content.length > 50) break;
      }
    }

    // If no content found with specific selectors, try broader search
    if (!post.content || post.content.length < 50) {
      const textElements = postElement.querySelectorAll('span, p, div');
      for (const element of textElements) {
        const text = element.textContent?.trim() || '';
        if (text.length > 50 && text.length < 2000 && !text.includes('Like') && !text.includes('Comment')) {
          post.content = text;
          break;
        }
      }
    }

    // Extract engagement metrics with more comprehensive selectors
    const engagementSelectors = {
      likes: [
        '.social-details-social-counts__reactions-count',
        '.social-counts-reactions__count',
        'button[aria-label*="like"] .social-details-social-counts__count-value',
        'button[aria-label*="reaction"] .social-details-social-counts__count-value',
        '.social-details-social-counts__item--reactions .social-details-social-counts__count-value',
        'span[aria-hidden="true"] + span[aria-hidden="true"]', // Common pattern for engagement numbers
        '.social-details-social-counts__count-value'
      ],
      comments: [
        '.social-details-social-counts__comments .social-details-social-counts__count-value',
        '.social-counts-comments__count',
        'button[aria-label*="comment"] .social-details-social-counts__count-value',
        '.social-details-social-counts__item--comments .social-details-social-counts__count-value'
      ],
      reposts: [
        '.social-details-social-counts__reposts .social-details-social-counts__count-value',
        '.social-counts-reshares__count',
        'button[aria-label*="repost"] .social-details-social-counts__count-value',
        'button[aria-label*="share"] .social-details-social-counts__count-value',
        '.social-details-social-counts__item--reposts .social-details-social-counts__count-value'
      ]
    };

    // Extract likes with debugging
    for (const selector of engagementSelectors.likes) {
      const element = postElement.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '0';
        const number = extractNumber(text);
        console.log(`Likes selector "${selector}": "${text}" -> ${number}`);
        if (number >= 0) { // Allow 0 likes
          post.likes = number;
          break;
        }
      }
    }

    // If no likes found with specific selectors, try aria-label extraction
    if (post.likes === 0) {
      const likeButton = postElement.querySelector('button[aria-label*="like"], button[aria-label*="reaction"]');
      if (likeButton) {
        const ariaLabel = likeButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/(\d+[\d,]*\.?\d*[KMB]?)\s*(?:likes?|reactions?)/i);
        if (match) {
          post.likes = extractNumber(match[1]);
          console.log(`Likes from aria-label: "${ariaLabel}" -> ${post.likes}`);
        }
      }
    }

    // Extract comments with debugging
    for (const selector of engagementSelectors.comments) {
      const element = postElement.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '0';
        const number = extractNumber(text);
        console.log(`Comments selector "${selector}": "${text}" -> ${number}`);
        if (number >= 0) { // Allow 0 comments
          post.comments = number;
          break;
        }
      }
    }

    // If no comments found, try aria-label
    if (post.comments === 0) {
      const commentButton = postElement.querySelector('button[aria-label*="comment"]');
      if (commentButton) {
        const ariaLabel = commentButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/(\d+[\d,]*\.?\d*[KMB]?)\s*comments?/i);
        if (match) {
          post.comments = extractNumber(match[1]);
          console.log(`Comments from aria-label: "${ariaLabel}" -> ${post.comments}`);
        }
      }
    }

    // Extract reposts/shares with debugging
    for (const selector of engagementSelectors.reposts) {
      const element = postElement.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '0';
        const number = extractNumber(text);
        console.log(`Reposts selector "${selector}": "${text}" -> ${number}`);
        if (number >= 0) { // Allow 0 reposts
          post.reposts = number;
          break;
        }
      }
    }

    // If no reposts found, try aria-label
    if (post.reposts === 0) {
      const shareButton = postElement.querySelector('button[aria-label*="repost"], button[aria-label*="share"]');
      if (shareButton) {
        const ariaLabel = shareButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/(\d+[\d,]*\.?\d*[KMB]?)\s*(?:reposts?|shares?)/i);
        if (match) {
          post.reposts = extractNumber(match[1]);
          console.log(`Reposts from aria-label: "${ariaLabel}" -> ${post.reposts}`);
        }
      }
    }

    // Try to extract post URL
    const linkElement = postElement.querySelector('a[href*="/feed/update/"]') || 
                       postElement.querySelector('a[href*="activity-"]');
    if (linkElement) {
      post.linkedinPostUrl = linkElement.href;
    } else {
      post.linkedinPostUrl = `${window.location.origin}/feed/update/activity-${Date.now()}-${index}`;
    }

    // Set approximate post date (LinkedIn doesn't always show exact dates)
    post.postDate = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString();

    return post;
  }

  // Extract numeric value from text (handles "1.2K", "500", etc.)
  function extractNumber(text) {
    if (!text) return 0;
    
    const match = text.match(/[\d,]+\.?\d*[KMB]?/i);
    if (!match) return 0;
    
    let number = match[0].replace(/,/g, '');
    
    if (number.includes('K')) {
      return Math.floor(parseFloat(number) * 1000);
    } else if (number.includes('M')) {
      return Math.floor(parseFloat(number) * 1000000);
    } else if (number.includes('B')) {
      return Math.floor(parseFloat(number) * 1000000000);
    } else {
      return parseInt(number) || 0;
    }
  }

  // Scroll to load all available posts
  async function scrollToLoadAllPosts() {
    console.log('Starting auto-scroll to load more posts...');
    
    const button = document.getElementById('linkedin-scraper-btn');
    let scrollCount = 0;
    const maxScrolls = 10; // Limit scrolling to prevent infinite loop
    let lastPostCount = 0;
    
    return new Promise((resolve) => {
      const scrollInterval = setInterval(() => {
        // Update button to show scrolling progress
        if (button) {
          button.innerHTML = `📜 Loading Posts... (${scrollCount}/${maxScrolls})`;
        }
        
        // Scroll to bottom
        window.scrollTo(0, document.body.scrollHeight);
        
        // Count current posts
        const currentPosts = document.querySelectorAll('.feed-shared-update-v2, .occludable-update, [data-urn*="activity"]').length;
        console.log(`Scroll ${scrollCount}: Found ${currentPosts} posts`);
        
        scrollCount++;
        
        // Stop if we've reached max scrolls or no new posts loaded
        if (scrollCount >= maxScrolls || (currentPosts === lastPostCount && scrollCount > 3)) {
          clearInterval(scrollInterval);
          console.log(`Finished scrolling. Total posts visible: ${currentPosts}`);
          
          // Reset button
          if (button) {
            button.innerHTML = '⏳ Extracting Posts...';
            button.style.background = '#ffa500';
          }
          
          // Wait a bit for any final loading
          setTimeout(resolve, 2000);
        }
        
        lastPostCount = currentPosts;
      }, 2000); // Scroll every 2 seconds
    });
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

  // Wait for LinkedIn content to load
  async function waitForContent(timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Check if LinkedIn content containers are loaded
      const hasContent = document.querySelector('.core-rail, .scaffold-layout__main, .application-outlet, .feed-shared-update-v2');
      if (hasContent) {
        console.log('LinkedIn content detected, waiting additional 2 seconds for posts to load...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('Timeout waiting for LinkedIn content to load');
    return false;
  }

  // Handle scrape button click
  async function handleScrapeClick() {
    const button = document.getElementById('linkedin-scraper-btn');
    if (button) {
      button.innerHTML = '⏳ Loading Content...';
      button.style.background = '#ffa500';
    }

    try {
      // Wait for LinkedIn content to fully load
      await waitForContent();
      
      if (button) {
        button.innerHTML = '⏳ Extracting Posts...';
      }
      
      const profileInfo = getProfileInfo();
      
      // Extract posts from current page
      let posts = [];
      
      // Check if we're on activity page, if not navigate there first
      if (window.location.href.includes('/recent-activity/')) {
        // On activity page - scroll to load more posts then extract
        await scrollToLoadAllPosts();
        posts = extractLinkedInPosts();
      } else {
        // We're on profile page, try to extract any visible posts or navigate to activity
        posts = extractLinkedInPosts();
        
        // If no posts found on profile page, suggest visiting activity page
        if (posts.length === 0) {
          console.log('No posts found on current page. Current URL:', window.location.href);
          
          if (button) {
            if (window.location.href.includes('/recent-activity/')) {
              button.innerHTML = '❌ No Posts Found';
              button.style.background = '#dc3545';
            } else {
              button.innerHTML = '🔄 Go to Activity Page';
              button.style.background = '#0073b1';
              
              // Add click listener to navigate to activity page
              button.removeEventListener('click', handleScrapeClick);
              button.addEventListener('click', () => {
                const activityUrl = `${profileInfo.profileUrl}/recent-activity/`;
                console.log('Navigating to activity page:', activityUrl);
                window.location.href = activityUrl;
              });
            }
          }
          return;
        }
      }

      if (posts.length === 0) {
        if (button) {
          button.innerHTML = '❌ No Posts Found';
          button.style.background = '#dc3545';
        }
        setTimeout(() => {
          if (button) {
            button.innerHTML = '📊 Scrape Posts';
            button.style.background = '#0073b1';
          }
        }, 3000);
        return;
      }

      // Send profile info and extracted posts to background script
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'scrapeProfile',
          profileInfo: profileInfo,
          posts: posts
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Chrome runtime error:', chrome.runtime.lastError);
            if (button) {
              button.innerHTML = '❌ Extension Error';
              button.style.background = '#dc3545';
            }
            return;
          }
          
          if (response && response.success) {
            // Update button to show success
            if (button) {
              button.innerHTML = '✅ Opening Dashboard...';
              button.style.background = '#28a745';
            }
          } else {
            if (button) {
              button.innerHTML = '❌ Upload Failed';
              button.style.background = '#dc3545';
            }
          }
        });
      } else {
        // Fallback: Direct API call if Chrome extension APIs not available
        console.log('Chrome extension APIs not available, making direct API call...');
        
        try {
          const response = await fetch('http://localhost:3000/api/scrape-dom', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profileInfo: profileInfo,
              posts: posts
            })
          });

          const data = await response.json();
          
          if (response.ok && data.success) {
            if (button) {
              button.innerHTML = '✅ Posts Saved!';
              button.style.background = '#28a745';
            }
            
            // Open dashboard in new window/tab
            const dashboardUrl = `http://localhost:3000/dashboard?profile=${encodeURIComponent(profileInfo.profileUrl)}&fresh=true`;
            window.open(dashboardUrl, '_blank');
          } else {
            throw new Error(data.error || 'Failed to save posts');
          }
        } catch (fetchError) {
          console.error('Direct API call failed:', fetchError);
          if (button) {
            button.innerHTML = '❌ API Error';
            button.style.background = '#dc3545';
          }
        }
      }

    } catch (error) {
      console.error('Scraping error:', error);
      if (button) {
        button.innerHTML = '❌ Error';
        button.style.background = '#dc3545';
      }
    }
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