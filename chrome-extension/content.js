// Simple LinkedIn Post Scraper - Current Layout Only
(function() {
  'use strict';

  // Simple Debug System
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
    },
    
    inspect: function(selector, description) {
      const elements = document.querySelectorAll(selector);
      this.log(`${description}: Found ${elements.length} elements with selector "${selector}"`);
      if (elements.length > 0 && elements.length <= 3) {
        elements.forEach((el, i) => {
          console.log(`  Element ${i}:`, el);
        });
      }
      return elements;
    },
    
    // Enable/disable debugging from console
    toggle: function() {
      this.enabled = !this.enabled;
      console.log(`🔍 Debug mode ${this.enabled ? 'enabled' : 'disabled'}`);
    }
  };

  // Check if we're on LinkedIn
  function isLinkedInProfile() {
    return window.location.href.includes('/in/') && 
           window.location.hostname.includes('linkedin.com');
  }

  // Get basic profile info
  function getProfileInfo() {
    const profileUrl = window.location.href.match(/https:\/\/[^\/]+\/in\/[^\/\?]+/)?.[0] || window.location.href;
    const fullName = document.querySelector('h1.text-heading-xlarge')?.textContent?.trim() || '';
    const profileImageUrl = document.querySelector('.pv-top-card-profile-picture__image')?.src || '';
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

  // Extract data from a single post
  function extractPostData(postElement, index) {
    debug.log(`Extracting data from post ${index + 1}`);
    
    // Get post content with multiple fallback selectors
    const contentSelectors = [
      '.feed-shared-text__text-view .break-words',
      '.feed-shared-text .break-words',
      '.feed-shared-text__text-view',
      '.feed-shared-text',
      '.feed-shared-update-v2__description .break-words',
      '.feed-shared-update-v2__description',
      '[data-test-id="main-feed-activity-card"] .break-words',
      '[data-test-id="main-feed-activity-card"] p',
      '.update-components-text .break-words',
      '.update-components-text',
      '.feed-shared-inline-show-more-text .break-words',
      '.feed-shared-inline-show-more-text'
    ];
    
    let content = '';
    let usedSelector = '';
    
    for (const selector of contentSelectors) {
      const element = postElement.querySelector(selector);
      if (element && element.textContent?.trim()) {
        content = element.textContent.trim();
        usedSelector = selector;
        break;
      }
    }
    
    debug.log(`Content length: ${content.length} characters (using selector: "${usedSelector}")`);
    if (!content) {
      debug.log('⚠️ Could not find content with any selector. Trying all text in post...');
      // Fallback: get any text content from the post
      const allText = postElement.textContent?.trim() || '';
      // Try to extract meaningful text (skip very short fragments)
      const textLines = allText.split('\n').filter(line => line.trim().length > 10);
      if (textLines.length > 0) {
        content = textLines.join(' ').substring(0, 500); // Limit to 500 chars
        debug.log(`Fallback content found: ${content.length} characters`);
      }
    }

    // Get engagement metrics
    const likesElement = postElement.querySelector('.social-details-social-counts__reactions-count');
    const likesText = likesElement?.textContent || '0';
    const likes = parseNumber(likesText);
    debug.log(`Likes: "${likesText}" → ${likes}`);

    const commentsElement = postElement.querySelector('.social-details-social-counts__comments .social-details-social-counts__count-value');
    const commentsText = commentsElement?.textContent || '0';
    const comments = parseNumber(commentsText);
    debug.log(`Comments: "${commentsText}" → ${comments}`);

    // Get reposts from aria-label
    const repostElement = postElement.querySelector('[aria-label*="repost"]');
    const repostText = repostElement?.getAttribute('aria-label') || '';
    const repostMatch = repostText.match(/(\d+)\s*repost/i);
    const reposts = repostMatch ? parseInt(repostMatch[1]) : 0;
    debug.log(`Reposts: "${repostText}" → ${reposts}`);

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

    // Extract real post publication date
    let postDate = new Date().toISOString(); // fallback to today
    
    // Try multiple selectors to find the post date
    const dateSelectors = [
      '.update-components-actor__sub-description',
      '.feed-shared-actor__sub-description',
      '.update-components-actor .visually-hidden',
      '.feed-shared-actor .visually-hidden',
      '[data-test-id="main-feed-activity-card"] time',
      'time[datetime]',
      '.feed-shared-update-v2 time',
      '.update-components-header time'
    ];
    
    for (const selector of dateSelectors) {
      const dateElement = postElement.querySelector(selector);
      if (dateElement) {
        // Try to get datetime attribute first
        const datetime = dateElement.getAttribute('datetime');
        if (datetime) {
          postDate = new Date(datetime).toISOString();
          debug.log(`Found post date from datetime attribute: ${postDate}`);
          break;
        }
        
        // Try to parse text content
        const dateText = dateElement.textContent?.trim();
        if (dateText) {
          const parsedDate = parseLinkedInDate(dateText);
          if (parsedDate) {
            postDate = parsedDate.toISOString();
            debug.log(`Found post date from text "${dateText}": ${postDate}`);
            break;
          }
        }
      }
    }
    
    if (postDate === new Date().toISOString()) {
      debug.log(`⚠️ Could not find real post date, using today as fallback`);
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
    const postElements = debug.inspect('.feed-shared-update-v2', 'Post containers');

    const posts = [];
    postElements.forEach((element, index) => {
      const postData = extractPostData(element, index);
      
      // Include posts with any content OR engagement metrics (for image/video posts)
      if (postData.content.length > 5 || postData.likes > 5 || postData.comments > 0) {
        // Add placeholder content for posts without text (images/videos)
        if (!postData.content || postData.content.length < 5) {
          postData.content = `[Image/Video Post - ${postData.likes} likes, ${postData.comments} comments, ${postData.reposts} reposts]`;
        }
        posts.push(postData);
        debug.log(`✅ Post ${index + 1} added: ${postData.likes} likes, ${postData.comments} comments, ${postData.reposts} reposts`);
      } else {
        debug.log(`❌ Post ${index + 1} skipped: no content and low engagement (${postData.content.length} chars, ${postData.likes} likes)`);
      }
    });

    debug.log(`📊 Final extraction results: ${posts.length} valid posts out of ${postElements.length} total`);
    return posts;
  }

  // Auto-scroll and click "Show more" buttons to load ALL posts
  function autoScroll() {
    return new Promise((resolve) => {
      let scrollCount = 0;
      let lastPostCount = 0;
      let noNewPostsCount = 0;
      const maxNoNewPosts = 5; // Stop after 5 attempts with no new posts
      
      debug.log('🎯 Starting infinite scroll and button clicking to load entire post history...');
      
      function scroll() {
        const currentPosts = document.querySelectorAll('.feed-shared-update-v2');
        const currentPostCount = currentPosts.length;
        
        debug.log(`Attempt ${scrollCount}: Found ${currentPostCount} posts total`);
        
        // First, scroll to bottom to trigger any lazy loading
        window.scrollTo(0, document.body.scrollHeight);
        
        // Look for "Show more" buttons and click them
        const showMoreSelectors = [
          'button[aria-label*="Show more"]',
          'button[aria-label*="show more"]',
          'button:contains("Show more")',
          'button:contains("Show more results")',
          '.scaffold-finite-scroll__load-button button',
          '.artdeco-button--secondary:contains("Show more")',
          '[data-test-id="pagination-show-more"] button',
          'button[class*="show-more"]',
          'button[class*="load-more"]'
        ];
        
        let buttonClicked = false;
        for (const selector of showMoreSelectors) {
          // Handle :contains() selector manually since it's not native
          if (selector.includes(':contains(')) {
            const text = selector.match(/:contains\("([^"]+)"\)/)?.[1];
            if (text) {
              const buttons = document.querySelectorAll('button');
              for (const button of buttons) {
                if (button.textContent?.toLowerCase().includes(text.toLowerCase()) && button.offsetParent !== null) {
                  debug.log(`🔵 Found and clicking button: "${button.textContent.trim()}"`);
                  button.click();
                  buttonClicked = true;
                  break;
                }
              }
            }
          } else {
            const button = document.querySelector(selector);
            if (button && button.offsetParent !== null) {
              debug.log(`🔵 Found and clicking button with selector: "${selector}"`);
              button.click();
              buttonClicked = true;
              break;
            }
          }
          
          if (buttonClicked) break;
        }
        
        if (buttonClicked) {
          debug.log('🔵 Clicked "Show more" button, waiting for content to load...');
          noNewPostsCount = 0; // Reset counter when we click a button
        }
        
        // Check if we got new posts
        if (currentPostCount === lastPostCount && !buttonClicked) {
          noNewPostsCount++;
          debug.log(`⚠️ No new posts loaded and no button found (${noNewPostsCount}/${maxNoNewPosts})`);
          
          if (noNewPostsCount >= maxNoNewPosts) {
            debug.log('🏁 Reached end of posts - no more "Show more" buttons or content. Stopping.');
            resolve();
            return;
          }
        } else if (currentPostCount > lastPostCount) {
          noNewPostsCount = 0; // Reset counter if we got new posts
          debug.log(`✅ Loaded ${currentPostCount - lastPostCount} new posts`);
        }
        
        lastPostCount = currentPostCount;
        scrollCount++;
        
        // Wait longer for content to load after clicking buttons
        const waitTime = buttonClicked ? 5000 : 3000;
        setTimeout(scroll, waitTime);
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
  }

  // Main scraping workflow
  async function handleScrapeClick() {
    try {
      debug.log('🚀 Starting LinkedIn scrape workflow...');
      
      const button = document.getElementById('linkedin-scraper-btn');
      button.textContent = '⏳ Scrolling...';
      button.disabled = true;

      // Auto-scroll to load ALL posts
      await autoScroll();

      // Wait for final content to load
      button.textContent = '⏳ Extracting...';
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Extract posts
      const posts = extractPosts();
      const profileInfo = getProfileInfo();
      
      debug.log('Profile info:', profileInfo);

      if (posts.length === 0) {
        throw new Error('No posts found. Try visiting the activity page: /recent-activity/all/');
      }

      // Send to background script
      button.textContent = '⏳ Saving...';
      debug.log('Sending to background script:', { profileInfo, postsCount: posts.length });
      
      chrome.runtime.sendMessage({
        action: 'scrapeProfile',
        profileInfo: profileInfo,
        posts: posts
      }, (response) => {
        if (response?.success) {
          debug.log('✅ Scrape completed successfully!', response);
          button.textContent = `✅ ${posts.length} posts!`;
          setTimeout(() => {
            button.textContent = '📊 Scrape Posts';
            button.disabled = false;
          }, 5000);
        } else {
          throw new Error(response?.error || 'Failed to save posts');
        }
      });

    } catch (error) {
      debug.error('Scraping failed', error);
      const button = document.getElementById('linkedin-scraper-btn');
      button.textContent = '❌ Failed';
      button.disabled = false;
      setTimeout(() => {
        button.textContent = '📊 Scrape Posts';
      }, 3000);
    }
  }

  // Initialize when page loads
  function init() {
    if (!isLinkedInProfile()) return;

    debug.log('🎯 Simple LinkedIn scraper loaded');
    
    // Wait for page to load, then create button
    setTimeout(() => {
      createScrapeButton();
    }, 2000);
  }

  // Expose debug tools to browser console
  window.LinkedInScraperDebug = {
    debug: debug,
    extractPosts: extractPosts,
    inspectSelectors: function() {
      debug.inspect('.feed-shared-update-v2', 'Post containers');
      debug.inspect('.feed-shared-text__text-view .break-words', 'Post content (primary)');
      debug.inspect('.feed-shared-text .break-words', 'Post content (alt 1)');
      debug.inspect('.feed-shared-text__text-view', 'Post content (alt 2)');
      debug.inspect('.social-details-social-counts__reactions-count', 'Likes');
      debug.inspect('.social-details-social-counts__comments .social-details-social-counts__count-value', 'Comments');
      debug.inspect('[aria-label*="repost"]', 'Reposts');
    },
    findPostUrls: function() {
      debug.log('🔍 COMPREHENSIVE POST URL SEARCH 🔍');
      
      // Get all posts
      const posts = document.querySelectorAll('.feed-shared-update-v2');
      debug.log(`Found ${posts.length} posts to analyze`);
      
      posts.forEach((post, postIndex) => {
        if (postIndex >= 3) return; // Only analyze first 3 posts
        
        debug.log(`\n=== POST ${postIndex + 1} URL ANALYSIS ===`);
        
        // Find ALL links in this post
        const allLinks = post.querySelectorAll('a[href]');
        debug.log(`Total links in post: ${allLinks.length}`);
        
        allLinks.forEach((link, linkIndex) => {
          const href = link.href;
          const text = link.textContent?.trim().substring(0, 50) || '[no text]';
          const classes = link.className || '[no classes]';
          
          // Categorize the link
          let category = 'other';
          if (href.includes('/posts/')) category = '🎯 POST URL';
          else if (href.includes('activity-')) category = '📝 ACTIVITY';
          else if (href.includes('/feed/update/')) category = '🔄 FEED UPDATE';
          else if (href.includes('/pulse/')) category = '📰 ARTICLE';
          else if (href.includes('/in/')) category = '👤 PROFILE';
          else if (href.includes('/company/')) category = '🏢 COMPANY';
          
          if (category.includes('🎯') || category.includes('📝') || category.includes('🔄')) {
            debug.log(`  ${category} Link ${linkIndex}: ${href}`);
            debug.log(`    Text: "${text}"`);
            debug.log(`    Classes: ${classes}`);
            console.log(`    Element:`, link);
          }
        });
        
        // Check data attributes that might contain URLs
        const dataUrn = post.getAttribute('data-urn');
        if (dataUrn) {
          debug.log(`  📊 Data URN: ${dataUrn}`);
        }
        
        // Check for any elements with post-related data attributes
        const dataElements = post.querySelectorAll('[data-urn], [data-id*="activity"], [data-post-id]');
        dataElements.forEach((el, i) => {
          debug.log(`  📊 Data element ${i}:`);
          debug.log(`    data-urn: ${el.getAttribute('data-urn') || 'none'}`);
          debug.log(`    data-id: ${el.getAttribute('data-id') || 'none'}`);
          debug.log(`    data-post-id: ${el.getAttribute('data-post-id') || 'none'}`);
        });
      });
      
      debug.log('\n🎯 SUMMARY: Look for links marked with 🎯 POST URL or 📝 ACTIVITY above!');
    },
    inspectFirstPost: function() {
      const firstPost = document.querySelector('.feed-shared-update-v2');
      if (firstPost) {
        debug.log('🔍 Inspecting first post structure...');
        console.log('First post element:', firstPost);
        
        // Try all content selectors on first post
        const contentSelectors = [
          '.feed-shared-text__text-view .break-words',
          '.feed-shared-text .break-words',
          '.feed-shared-text__text-view',
          '.feed-shared-text',
          '.feed-shared-update-v2__description .break-words',
          '.feed-shared-update-v2__description'
        ];
        
        contentSelectors.forEach(selector => {
          const element = firstPost.querySelector(selector);
          if (element) {
            debug.log(`✅ Content found with "${selector}": "${element.textContent?.trim().substring(0, 100)}..."`);
          } else {
            debug.log(`❌ Content not found: "${selector}"`);
          }
        });

        // Try all URL selectors on first post
        const urlSelectors = [
          'a[href*="/posts/"]',
          'a[href*="activity-"]',
          '.feed-shared-update-v2 a[href*="/posts/"]',
          '.update-components-actor a[href*="/posts/"]',
          '[data-urn] a[href*="/posts/"]',
          'a[href*="/pulse/"]'
        ];
        
        debug.log('🔗 Looking for post URLs...');
        urlSelectors.forEach(selector => {
          const element = firstPost.querySelector(selector);
          if (element && element.href) {
            debug.log(`✅ URL found with "${selector}": ${element.href}`);
          } else {
            debug.log(`❌ URL not found: "${selector}"`);
          }
        });

        // Show all links in the post
        const allLinks = firstPost.querySelectorAll('a[href]');
        debug.log(`🔗 All links in post (${allLinks.length} total):`);
        allLinks.forEach((link, i) => {
          if (i < 5) { // Show first 5 links
            debug.log(`  Link ${i}: ${link.href}`);
          }
        });
      } else {
        debug.log('❌ No posts found on page');
      }
    },
    testExtraction: function() {
      debug.log('🧪 Testing post extraction...');
      return extractPosts();
    },
    toggleDebug: function() {
      debug.toggle();
    }
  };

  debug.log('🔧 Debug tools available at: window.LinkedInScraperDebug');
  
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