// Simple LinkedIn Post Scraper - Current Layout Only
(function() {
  'use strict';

  // ==========================================
  // CONFIGURATION - All settings in one place
  // ==========================================
  // Last tested: 2024-10-10
  // Based on selector testing results
  const CONFIG = {
    // Selectors (tested and verified)
    SELECTORS: {
      POST_CONTAINER: '.feed-shared-update-v2',
      POST_CONTENT: '.feed-shared-update-v2__description .break-words',
      POST_CONTENT_FALLBACK: '.feed-shared-update-v2__description',
      LIKES: '.social-details-social-counts__reactions-count',
      COMMENTS: '.social-details-social-counts__comments .social-details-social-counts__count-value',
      REPOSTS: '[aria-label*="repost"]',
      REPOST_HEADER: '.update-components-header__text-view',
      POST_DATE: '.update-components-actor__sub-description',
      PROFILE_NAME: 'h1.text-heading-xlarge',
      PROFILE_IMAGE: '.pv-top-card-profile-picture__image',
      SHOW_MORE_BUTTON: 'button[class*="show-more"]', // Only working selector!
    },
    
    // Timing (milliseconds)
    SCROLL_WAIT_MS: 5000,
    BUTTON_WAIT_MS: 12000,
    EXTRACTION_WAIT_MS: 4000,
    
    // Thresholds
    MAX_NO_NEW_POSTS: 5,
    MAX_INEFFECTIVE_CLICKS: 3,
    MIN_CONTENT_LENGTH: 1,
    
    // Debug
    DEBUG_ENABLED: true,
  };

  // Simplified Debug System for Production
  const debug = {
    enabled: true,
    
    log: function(message, data = null) {
      if (!this.enabled) return;
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] 🔍 LinkedIn Scraper: ${message}`);
      if (data) console.log(data);
    },
    
    error: function(message, error = null) {
      const timestamp = new Date().toLocaleTimeString();
      console.error(`[${timestamp}] ❌ LinkedIn Scraper Error: ${message}`);
      if (error) console.error(error);
    }
  };

  // ==========================================
  // UTILITY FUNCTIONS - Reusable helpers
  // ==========================================
  
  // Safely get text content from element
  function getText(element, defaultValue = '') {
    return element?.textContent?.trim() || defaultValue;
  }
  
  // Get engagement count from selector
  function getEngagementCount(postElement, selector) {
    return parseNumber(getText(postElement.querySelector(selector), '0'));
  }

  // Check if we're on LinkedIn
  function isLinkedInProfile() {
    return window.location.href.includes('/in/') && 
           window.location.hostname.includes('linkedin.com');
  }

  // Get basic profile info
  function getProfileInfo() {
    const profileUrl = window.location.href.match(/https:\/\/[^\/]+\/in\/[^\/\?]+/)?.[0] || window.location.href;
    const fullName = getText(document.querySelector(CONFIG.SELECTORS.PROFILE_NAME));
    const profileImageUrl = document.querySelector(CONFIG.SELECTORS.PROFILE_IMAGE)?.src || '';
    const username = profileUrl.split('/in/')[1]?.split('/')[0] || '';

    return { profileUrl, fullName, profileImageUrl, username };
  }

  // Convert "1.2K" to 1200
  function parseNumber(text) {
    if (!text) return 0;
    const cleanText = text.replace(/[,\s]/g, '');
    const match = cleanText.match(/(\d+\.?\d*)[KMB]?/i);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const suffix = cleanText.slice(-1).toLowerCase();
    
    if (suffix === 'k') return Math.round(num * 1000);
    if (suffix === 'm') return Math.round(num * 1000000);
    if (suffix === 'b') return Math.round(num * 1000000000);
    return Math.round(num);
  }

  // Parse LinkedIn date formats and return date-only (no time)
  function parseLinkedInDate(dateText) {
    if (!dateText) return null;
    
    const now = new Date();
    const text = dateText.toLowerCase().trim();
    
    // Handle relative dates - set to start of day (midnight)
    if (text.includes('now') || text.includes('just now')) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return today;
    }
    
    if (text.includes('min') || text.includes('hour')) {
      // Recent posts (within hours) count as today
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return today;
    }
    
    if (text.includes('day')) {
      const days = parseInt(text.match(/(\d+)/)?.[1]) || 0;
      const targetDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    }
    
    if (text.includes('week')) {
      const weeks = parseInt(text.match(/(\d+)/)?.[1]) || 0;
      const targetDate = new Date(now.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);
      return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    }
    
    if (text.includes('month')) {
      const months = parseInt(text.match(/(\d+)/)?.[1]) || 0;
      const targetDate = new Date(now);
      targetDate.setMonth(targetDate.getMonth() - months);
      return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    }
    
    if (text.includes('year')) {
      const years = parseInt(text.match(/(\d+)/)?.[1]) || 0;
      const targetDate = new Date(now);
      targetDate.setFullYear(targetDate.getFullYear() - years);
      return new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
    }
    
    // Try to parse absolute dates
    try {
      // Handle formats like "Dec 15, 2024" or "15 Dec 2024"
      const parsed = new Date(dateText);
      if (!isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
        // Return date-only (midnight of that date)
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
      }
    } catch (e) {
      // Ignore parsing errors
    }
    
    return null;
  }

  // Simple and reliable repost detection using the proven CSS selector
  function isRepost(postElement) {
    // Use the structural selector that works all the time
    const headerElement = postElement.querySelector('.update-components-header__text-view');
    
    if (headerElement && headerElement.textContent) {
      const text = headerElement.textContent.trim();
      // Check if this element contains any repost-related text
      if (text.length > 0) {
        debug.log(`🔄 Repost detected: "${text.substring(0, 100)}..."`);
        return true;
      }
    }
    
    return false;
  }

  // Extract data from a single post
  function extractPostData(postElement, index) {
    debug.log(`Extracting data from post ${index + 1}`);
    
    // Check if this is a repost and skip it
    if (isRepost(postElement)) {
      debug.log(`❌ Post ${index + 1} is a REPOST - skipping`);
      return null; // Return null to indicate this post should be skipped
    }
    
    // Get post content - simplified (tested selectors work!)
    const content = getText(postElement.querySelector(CONFIG.SELECTORS.POST_CONTENT))
      || getText(postElement.querySelector(CONFIG.SELECTORS.POST_CONTENT_FALLBACK));
    
    debug.log(`Content: ${content.length} characters`);

    // Get engagement metrics - simplified
    const likes = getEngagementCount(postElement, CONFIG.SELECTORS.LIKES);
    const comments = getEngagementCount(postElement, CONFIG.SELECTORS.COMMENTS);
    
    const repostElement = postElement.querySelector(CONFIG.SELECTORS.REPOSTS);
    const reposts = parseNumber(repostElement?.getAttribute('aria-label')?.match(/(\d+)\s*repost/i)?.[1] || '0');
    
    debug.log(`Engagement: ${likes}L / ${comments}C / ${reposts}R`);

    // Extract real LinkedIn post URL from data-urn
    let linkedinPostUrl = '';
    
    // First, try to find direct post links
    const directLink = postElement.querySelector('a[href*="/posts/"], a[href*="/pulse/"]');
    if (directLink && directLink.href) {
      linkedinPostUrl = directLink.href;
      debug.log(`Found direct post URL: ${linkedinPostUrl}`);
    } else {
      // Extract from data-urn attribute
      const dataUrn = postElement.getAttribute('data-urn');
      if (dataUrn && dataUrn.includes('activity:')) {
        // Convert urn:li:activity:7341909405757558784 to LinkedIn post URL
        const activityId = dataUrn.split('activity:')[1];
        if (activityId) {
          linkedinPostUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${activityId}/`;
          debug.log(`Generated post URL from data-urn: ${linkedinPostUrl}`);
        }
      }
    }
    
    // Final fallback if nothing found
    if (!linkedinPostUrl) {
      debug.error(`⚠️ Could not find post URL for post ${index + 1}`);
      linkedinPostUrl = `https://www.linkedin.com/feed/update/post-${Date.now()}-${index}`;
    }

    // Extract post date - simplified
    let postDate = new Date().toISOString(); // fallback to today
    const dateElement = postElement.querySelector(CONFIG.SELECTORS.POST_DATE);
    
    if (dateElement) {
      const datetime = dateElement.getAttribute('datetime');
      if (datetime) {
        postDate = new Date(datetime).toISOString();
      } else {
        const parsedDate = parseLinkedInDate(getText(dateElement));
        if (parsedDate) postDate = parsedDate.toISOString();
      }
    }

    const postData = {
      content,
      likes,
      comments,
      reposts,
      linkedinPostUrl,
      postDate
    };

    debug.log(`Post ${index + 1} extracted:`, postData);
    return postData;
  }

  // Main extraction function
  function extractPosts() {
    debug.log('🎯 Starting post extraction...');
    
    // Find all posts using the working selector
    const postElements = document.querySelectorAll(CONFIG.SELECTORS.POST_CONTAINER);
    debug.log(`Found ${postElements.length} post elements in DOM`);

    const posts = [];
    let filteredCount = 0;
    let repostCount = 0;
    let filteredReasons = {
      noContent: 0,
      shortContent: 0,
      noEngagement: 0,
      reposts: 0,
      total: 0
    };

    postElements.forEach((element, index) => {
      const postData = extractPostData(element, index);
      
      // Skip if post was identified as a repost
      if (postData === null) {
        repostCount++;
        filteredCount++;
        filteredReasons.reposts++;
        filteredReasons.total++;
        debug.log(`🔄 Post ${index + 1} SKIPPED: Repost detected`);
        return; // Skip to next post
      }
      
      // Enhanced logging for filtering decisions
      const contentLength = postData.content ? postData.content.length : 0;
      const hasEngagement = postData.likes > 0 || postData.comments > 0 || postData.reposts > 0;
      const contentPreview = postData.content ? postData.content.substring(0, 50) + '...' : '[no content]';
      
      debug.log(`📝 Post ${index + 1}: ${contentLength} chars, ${postData.likes}L/${postData.comments}C/${postData.reposts}R - "${contentPreview}"`);
      
      // Relaxed filtering: Include posts with ANY content OR ANY engagement
      if (contentLength > CONFIG.MIN_CONTENT_LENGTH || hasEngagement) {
        // Add placeholder content for posts without text (images/videos)
        if (!postData.content || contentLength < 5) {
          postData.content = `[Image/Video Post - ${postData.likes} likes, ${postData.comments} comments, ${postData.reposts} reposts]`;
        }
        posts.push(postData);
        debug.log(`✅ Post ${index + 1} INCLUDED: ${postData.likes}L/${postData.comments}C/${postData.reposts}R`);
      } else {
        filteredCount++;
        filteredReasons.total++;
        
        // Track specific reasons for filtering
        if (contentLength === 0) {
          filteredReasons.noContent++;
          debug.log(`❌ Post ${index + 1} FILTERED: No content`);
        } else if (contentLength === 1) {
          filteredReasons.shortContent++;
          debug.log(`❌ Post ${index + 1} FILTERED: Content too short (${contentLength} chars)`);
        } else if (!hasEngagement) {
          filteredReasons.noEngagement++;
          debug.log(`❌ Post ${index + 1} FILTERED: No engagement (${postData.likes}L/${postData.comments}C/${postData.reposts}R)`);
        }
      }
    });

    // Enhanced final statistics
    debug.log(`📊 EXTRACTION SUMMARY:`);
    debug.log(`  🔍 Total posts found: ${postElements.length}`);
    debug.log(`  ✅ Posts included: ${posts.length}`);
    debug.log(`  ❌ Posts filtered: ${filteredCount}`);
    debug.log(`  🔄 Reposts skipped: ${repostCount}`);
    debug.log(`  📈 Inclusion rate: ${((posts.length / postElements.length) * 100).toFixed(1)}%`);
    debug.log(`  🎯 Original content rate: ${(((posts.length) / (postElements.length - repostCount)) * 100).toFixed(1)}%`);
    debug.log(`📊 FILTERING BREAKDOWN:`);
    debug.log(`  Reposts: ${filteredReasons.reposts}`);
    debug.log(`  No content: ${filteredReasons.noContent}`);
    debug.log(`  Short content: ${filteredReasons.shortContent}`);
    debug.log(`  No engagement: ${filteredReasons.noEngagement}`);
    
    return posts;
  }

  // Auto-scroll to load ALL posts (optimized approach)
  function autoScroll() {
    return new Promise((resolve) => {
      let scrollCount = 0;
      let lastPageHeight = 0;
      let noHeightChangeCount = 0;
      const maxNoHeightChange = 3; // Stop after 3 attempts with no height change
      
      debug.log('🎯 Starting optimized auto-scroll to load entire post history...');
      
      function scroll() {
        // Check if user clicked stop
        if (shouldStopScraping) {
          debug.log('🛑 Scraping stopped by user');
          resolve();
          return;
        }
        
        // Get current page height
        const currentPageHeight = document.documentElement.scrollHeight;
        
        debug.log(`Scroll ${scrollCount}: Page height ${currentPageHeight}px`);
        
        // Update button with scroll progress
        const button = document.getElementById('linkedin-scraper-btn');
        if (button) {
          button.textContent = `📊 Scrolling... (attempt ${scrollCount + 1})`;
        }
        
        // Scroll to bottom to trigger lazy loading
        window.scrollTo(0, currentPageHeight);
        
        // Check if page height changed (new content loaded)
        if (currentPageHeight === lastPageHeight) {
          noHeightChangeCount++;
          debug.log(`⚠️ No height change (${noHeightChangeCount}/${maxNoHeightChange})`);
          
          if (noHeightChangeCount >= maxNoHeightChange) {
            debug.log('🏁 Reached end of posts - no more content loading. Stopping.');
            
            // Show continue loading button
            const continueButton = document.getElementById('linkedin-scraper-continue-btn');
            if (continueButton) {
              continueButton.style.display = 'block';
              debug.log('📢 Showing "Continue Loading" button for manual retry');
            }
            
            resolve();
            return;
          }
        } else {
          // Page height changed - new content loaded!
          noHeightChangeCount = 0;
          const heightIncrease = currentPageHeight - lastPageHeight;
          debug.log(`✅ Page height increased by ${heightIncrease}px - new content loaded!`);
        }
        
        lastPageHeight = currentPageHeight;
        scrollCount++;
        
        // Wait for content to load, then scroll again
        setTimeout(scroll, CONFIG.SCROLL_WAIT_MS);
      }

      scroll();
    });
  }

  // Create the scrape button
  function createScrapeButton() {
    if (document.getElementById('linkedin-scraper-btn')) return;

    const button = document.createElement('button');
    button.id = 'linkedin-scraper-btn';
    button.innerHTML = '📊 Scrape Posts';
    button.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      z-index: 10000;
      background: #0073b1;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 14px;
    `;

    button.addEventListener('click', handleScrapeClick);
    document.body.appendChild(button);
    
    // Create stop button (initially hidden)
    const stopButton = document.createElement('button');
    stopButton.id = 'linkedin-scraper-stop-btn';
    stopButton.innerHTML = '⏹️ Stop & Save';
    stopButton.style.cssText = `
      position: fixed;
      top: 130px;
      right: 20px;
      z-index: 10000;
      background: #e74c3c;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 14px;
      display: none;
    `;

    stopButton.addEventListener('click', handleStopAndSave);
    document.body.appendChild(stopButton);
    
    // Create download-only button
    const downloadButton = document.createElement('button');
    downloadButton.id = 'linkedin-scraper-download-btn';
    downloadButton.innerHTML = '📦 Download Only';
    downloadButton.style.cssText = `
      position: fixed;
      top: 180px;
      right: 20px;
      z-index: 10000;
      background: #9b59b6;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 14px;
    `;

    downloadButton.addEventListener('click', handleDownloadOnlyMode);
    document.body.appendChild(downloadButton);
    
    // Create continue loading button (initially hidden)
    const continueButton = document.createElement('button');
    continueButton.id = 'linkedin-scraper-continue-btn';
    continueButton.innerHTML = '🔄 Continue Loading';
    continueButton.style.cssText = `
      position: fixed;
      top: 230px;
      right: 20px;
      z-index: 10000;
      background: #f39c12;
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      font-size: 14px;
      display: none;
    `;

    continueButton.addEventListener('click', handleContinueLoading);
    document.body.appendChild(continueButton);
  }

  // Global variables to control scraping
  let isScrapingActive = false;
  let shouldStopScraping = false;
  let forceDownloadMode = false;
  let currentScrollPromiseResolve = null;

  // Fallback: Save data locally if extension fails
  function saveDataAsDownload(profileInfo, posts) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const username = profileInfo.username || 'unknown';
      
      const data = {
        profileInfo,
        scrapedAt: new Date().toISOString(),
        posts: posts
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `${username}_${timestamp}_posts_backup.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      debug.log(`📦 Data saved as download: ${link.download}`);
      return true;
    } catch (error) {
      debug.error('Failed to save data as download:', error);
      return false;
    }
  }

  // Stop and save current posts
  async function handleStopAndSave() {
    debug.log('⏹️ Stop button clicked - saving current posts...');
    shouldStopScraping = true;
    
    const stopButton = document.getElementById('linkedin-scraper-stop-btn');
    const mainButton = document.getElementById('linkedin-scraper-btn');
    
    stopButton.textContent = '⏳ Stopping...';
    stopButton.disabled = true;
    
    // Extract and save current posts
    await saveCurrentPosts();
  }

  // Extract and save posts without scrolling
  async function saveCurrentPosts() {
    try {
      const posts = extractPosts();
      const profileInfo = getProfileInfo();
      
      debug.log('📊 Saving current posts:', { profileInfo, postsCount: posts.length });

      if (posts.length === 0) {
        throw new Error('No posts found to save');
      }

      // Use download mode if forced or extension issues
      if (forceDownloadMode) {
        const success = saveDataAsDownload(profileInfo, posts);
        if (success) {
          const mainButton = document.getElementById('linkedin-scraper-btn');
          mainButton.textContent = `📦 ${posts.length} posts downloaded!`;
          setTimeout(() => {
            mainButton.textContent = '📊 Scrape Posts';
          }, 5000);
          return;
        }
      }

      await sendPostsToBackground(profileInfo, posts);
      
    } catch (error) {
      debug.error('Failed to save current posts', error);
      const mainButton = document.getElementById('linkedin-scraper-btn');
      
      // Try fallback download when extension fails
      if (error.message && error.message.includes('Chrome extension runtime not available')) {
        debug.log('🔄 Extension failed, attempting fallback download...');
        try {
          const success = saveDataAsDownload(profileInfo, posts);
          if (success) {
            mainButton.textContent = '📦 Downloaded!';
            debug.log('✅ Fallback download successful');
            return;
          }
        } catch (fallbackError) {
          debug.error('Fallback download also failed:', fallbackError);
        }
      }
      
      mainButton.textContent = '❌ Failed';
    }
  }

  // Handle download-only mode
  async function handleDownloadOnlyMode() {
    debug.log('📦 Download-only mode activated');
    forceDownloadMode = true;
    
    const downloadButton = document.getElementById('linkedin-scraper-download-btn');
    downloadButton.textContent = '⏳ Loading...';
    downloadButton.disabled = true;
    
    try {
      // Start regular scraping workflow but force download mode
      await handleScrapeClick();
    } catch (error) {
      debug.error('Download-only mode failed', error);
      downloadButton.textContent = '❌ Failed';
    } finally {
      downloadButton.disabled = false;
      setTimeout(() => {
        downloadButton.textContent = '📦 Download Only';
        forceDownloadMode = false;
      }, 3000);
    }
  }

  // Handle continue loading
  async function handleContinueLoading() {
    debug.log('🔄 Continue loading activated');
    
    const continueButton = document.getElementById('linkedin-scraper-continue-btn');
    const mainButton = document.getElementById('linkedin-scraper-btn');
    
    continueButton.textContent = '⏳ Loading...';
    continueButton.disabled = true;
    continueButton.style.display = 'none';
    
    try {
      // Reset scraping state
      shouldStopScraping = false;
      
      // Show main button as loading again
      mainButton.textContent = '⏳ Continuing...';
      mainButton.disabled = true;
      
      // Continue auto-scroll
      await autoScroll();
      
      // Extract posts after continued loading
      mainButton.textContent = '⏳ Extracting...';
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const posts = extractPosts();
      const profileInfo = getProfileInfo();
      
      if (posts.length === 0) {
        throw new Error('No posts found after continued loading');
      }

      // Save posts (respecting download mode if set)
      await saveCurrentPosts();
      
    } catch (error) {
      debug.error('Continue loading failed', error);
      mainButton.textContent = '❌ Failed';
      setTimeout(() => {
        mainButton.textContent = '📊 Scrape Posts';
      }, 3000);
    } finally {
      continueButton.disabled = false;
      continueButton.textContent = '🔄 Continue Loading';
      mainButton.disabled = false;
    }
  }

  // Enhanced Chrome runtime connection with retry logic
  async function sendPostsToBackground(profileInfo, posts, retryCount = 0) {
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    // Enhanced runtime availability check
    function isRuntimeAvailable() {
      try {
        return !!(chrome && chrome.runtime && chrome.runtime.sendMessage && chrome.runtime.id);
      } catch (e) {
        return false;
      }
    }
    
    if (!isRuntimeAvailable()) {
      if (retryCount < maxRetries) {
        debug.log(`⚠️ Runtime unavailable, retrying in ${retryDelay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return sendPostsToBackground(profileInfo, posts, retryCount + 1);
      } else {
        throw new Error(`Chrome extension runtime not available after ${maxRetries} attempts. Please:\n1. Reload the extension in chrome://extensions/\n2. Refresh this LinkedIn page\n3. Try scraping again`);
      }
    }
    
    debug.log('✅ Chrome runtime available, sending message...');
    
    return new Promise((resolve, reject) => {
      // Set a timeout for the message response
      const messageTimeout = setTimeout(() => {
        reject(new Error('Message timeout - extension may be unresponsive'));
      }, 10000); // 10 second timeout
      
      chrome.runtime.sendMessage({
        action: 'scrapeProfile',
        profileInfo: profileInfo,
        posts: posts
      }, (response) => {
        clearTimeout(messageTimeout);
        
        if (chrome.runtime.lastError) {
          const error = chrome.runtime.lastError.message;
          debug.error('Runtime error:', error);
          
          // If it's a connection error and we haven't retried enough, try again
          if (error.includes('Extension context invalidated') && retryCount < maxRetries) {
            debug.log(`🔄 Extension context invalidated, retrying... (attempt ${retryCount + 1}/${maxRetries})`);
            setTimeout(() => {
              sendPostsToBackground(profileInfo, posts, retryCount + 1)
                .then(resolve)
                .catch(reject);
            }, retryDelay);
            return;
          }
          
          // Try fallback download if extension completely fails
          if (error.includes('Could not establish connection') || 
              error.includes('Extension context invalidated') ||
              error.includes('Chrome extension runtime not available') ||
              error.includes('message port closed')) {
            debug.log('🔄 Extension failed, attempting fallback download...');
            try {
              const success = saveDataAsDownload(profileInfo, posts);
              if (success) {
                resolve({ success: true, method: 'download', message: 'Data saved as download due to extension issues' });
                return;
              }
            } catch (fallbackError) {
              debug.error('Fallback download also failed:', fallbackError);
            }
          }
          
          reject(new Error(`Extension error: ${error}`));
          return;
        }
        
        if (response?.success) {
          debug.log('✅ Posts saved successfully!', response);
          
          const mainButton = document.getElementById('linkedin-scraper-btn');
          const stopButton = document.getElementById('linkedin-scraper-stop-btn');
          
          // Different messages for different save methods
          if (response.method === 'download') {
            mainButton.textContent = `📦 ${posts.length} posts downloaded!`;
          } else {
            mainButton.textContent = `✅ ${posts.length} posts saved!`;
          }
          
          mainButton.disabled = false;
          stopButton.style.display = 'none';
          
          // Restore other buttons
          const downloadButton = document.getElementById('linkedin-scraper-download-btn');
          const continueButton = document.getElementById('linkedin-scraper-continue-btn');
          if (downloadButton) downloadButton.style.display = 'block';
          if (continueButton) continueButton.style.display = 'none'; // Hide continue button on success
          
          setTimeout(() => {
            mainButton.textContent = '📊 Scrape Posts';
          }, 5000);
          
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to save posts'));
        }
      });
    });
  }

  // Main scraping workflow
  async function handleScrapeClick() {
    try {
      debug.log('🚀 Starting LinkedIn scrape workflow...');
      
      const button = document.getElementById('linkedin-scraper-btn');
      const stopButton = document.getElementById('linkedin-scraper-stop-btn');
      
      button.textContent = '⏳ Scrolling...';
      button.disabled = true;
      stopButton.style.display = 'block';
      
      // Hide other buttons during scraping
      const downloadButton = document.getElementById('linkedin-scraper-download-btn');
      const continueButton = document.getElementById('linkedin-scraper-continue-btn');
      if (downloadButton) downloadButton.style.display = 'none';
      if (continueButton) continueButton.style.display = 'none';
      
      isScrapingActive = true;
      shouldStopScraping = false;

      // Auto-scroll to load ALL posts
      await autoScroll();

      // Wait for final content to load
      button.textContent = '⏳ Extracting...';
      await new Promise(resolve => setTimeout(resolve, CONFIG.EXTRACTION_WAIT_MS));

      // Extract posts
      const posts = extractPosts();
      const profileInfo = getProfileInfo();
      
      debug.log('Profile info:', profileInfo);

      if (posts.length === 0) {
        throw new Error('No posts found. Try visiting the activity page: /recent-activity/all/');
      }

      // Send to background script using the new function
      button.textContent = '⏳ Saving...';
      await sendPostsToBackground(profileInfo, posts);
      
      isScrapingActive = false;

    } catch (error) {
      debug.error('Scraping failed', error);
      const button = document.getElementById('linkedin-scraper-btn');
      const stopButton = document.getElementById('linkedin-scraper-stop-btn');
      
      // Provide specific error messages based on error type
      if (error.message.includes('Chrome extension runtime not available')) {
        button.textContent = '🔌 Extension Issue';
        // Show helpful instructions in console
        console.log('🔧 EXTENSION TROUBLESHOOTING:');
        console.log('1. Go to chrome://extensions/');
        console.log('2. Find "LinkedIn Scraper" and click the reload button');
        console.log('3. Refresh this LinkedIn page');
        console.log('4. Try scraping again');
      } else if (error.message.includes('No posts found')) {
        button.textContent = '📭 No Posts';
        console.log('💡 TIP: Try visiting the user\'s activity page: /recent-activity/all/');
      } else if (error.message.includes('timeout')) {
        button.textContent = '⏱️ Timeout';
        console.log('💡 TIP: The page may be loading slowly. Try again in a few seconds.');
      } else {
        button.textContent = '❌ Failed';
      }
      
      button.disabled = false;
      stopButton.style.display = 'none';
      isScrapingActive = false;
      
      // Restore other buttons
      const downloadButton = document.getElementById('linkedin-scraper-download-btn');
      const continueButton = document.getElementById('linkedin-scraper-continue-btn');
      if (downloadButton) downloadButton.style.display = 'block';
      // Don't show continue button unless needed
      
      setTimeout(() => {
        button.textContent = '📊 Scrape Posts';
      }, 5000);
    }
  }

  // Check extension health on startup
  function checkExtensionHealth() {
    try {
      if (!chrome || !chrome.runtime) {
        console.warn('⚠️ Chrome extension APIs not available. Scraper will use download fallback.');
        return false;
      }
      
      if (!chrome.runtime.id) {
        console.warn('⚠️ Extension context may be invalid. Consider reloading the extension.');
        return false;
      }
      
      debug.log('✅ Extension health check passed');
      return true;
    } catch (error) {
      console.warn('⚠️ Extension health check failed:', error.message);
      return false;
    }
  }

  // Initialize when page loads
  function init() {
    if (!isLinkedInProfile()) return;

    debug.log('🎯 Simple LinkedIn scraper loaded');
    
    // Check extension health
    const extensionHealthy = checkExtensionHealth();
    if (!extensionHealthy) {
      console.log('📦 Scraper will save data as downloads if extension connection fails');
    }
    
    // Wait for page to load, then create button
    setTimeout(() => {
      createScrapeButton();
    }, 2000);
  }

  // Start the scraper
  init();

  // Handle navigation in single-page app
  let lastUrl = location.href;
  new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
      lastUrl = url;
      setTimeout(init, 1000);
    }
  }).observe(document, { subtree: true, childList: true });

})();