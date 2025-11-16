# Claude Instructions

This file contains instructions and context for Claude Code.

## Project Information
LinkedIn Post Scraper - A Chrome extension and web application that scrapes LinkedIn posts and analyzes engagement metrics. Built with Next.js, Supabase, and Chrome Extension APIs.

## Development Commands
- **Start dev server**: `pnpm dev`
- **Build**: `pnpm build` 
- **Test**: `pnpm test`
- **Lint**: `pnpm lint`

## Local Testing Setup (Current Implementation)

We've created a **local file-based testing system** to test the scraper without Supabase dependencies:

### File Structure
```
scraped-data/
├── profiles/          # Profile metadata as JSON
└── posts/            # Scraped posts as JSON arrays
```

### API Endpoints
- **Local scraping**: `POST /api/scrape-local` - Saves scraped data to local JSON files
- **Original Supabase**: `POST /api/scrape-dom` - Saves to Supabase database
- **Posts retrieval**: `GET /api/posts` - Gets posts from Supabase

### How to Test the Scraper Locally

1. **Start the development server**:
   ```bash
   pnpm dev
   ```

2. **Load Chrome Extension**:
   - Open Chrome → `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" 
   - Select the `chrome-extension/` folder

3. **Test on LinkedIn**:
   - Visit any LinkedIn profile (`linkedin.com/in/username`)
   - Click the blue "📊 Scrape Posts" button
   - Check browser console for logs
   - Scraped data will be saved to `scraped-data/` folder

4. **Verify Results**:
   - Check `scraped-data/profiles/` for profile JSON files
   - Check `scraped-data/posts/` for posts JSON files
   - Files are named: `{username}_{timestamp}.json`

### Current Chrome Extension Configuration
- **Background script**: Modified to use `/api/scrape-local` endpoint
- **Content script**: Extracts posts from LinkedIn DOM
- **Local storage**: Saves results as JSON files instead of database

### File Formats

**Profile file** (`username_timestamp.json`):
```json
{
  "profileInfo": {
    "profileUrl": "https://linkedin.com/in/username",
    "username": "username", 
    "fullName": "Full Name",
    "profileImageUrl": "..."
  },
  "scrapedAt": "2024-01-15T10:30:00Z",
  "postsCount": 45
}
```

**Posts file** (`username_timestamp_posts.json`):
```json
{
  "profileUrl": "https://linkedin.com/in/username",
  "scrapedAt": "2024-01-15T10:30:00Z", 
  "posts": [
    {
      "content": "Post text content...",
      "likes": 123,
      "comments": 45, 
      "reposts": 12,
      "linkedinPostUrl": "https://linkedin.com/feed/update/...",
      "postDate": "2024-01-14",
      "scrapedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Chrome Extension Architecture - How It Works

This section provides a detailed explanation of how the Chrome extension works internally, covering the execution flow of both `content.js` and `background.js`.

### Technology Stack
- **No external libraries** - Pure vanilla JavaScript
- **Native DOM APIs** - `querySelector`, `querySelectorAll`, `scrollTo`, etc.
- **Chrome Extension APIs** - `chrome.runtime`, `chrome.storage`, `chrome.tabs`
- **No bundler** - Scripts run directly without build process

### CONTENT.JS - Execution Flow

The content script runs directly on LinkedIn profile pages and handles all scraping logic.

#### Phase 1: Initialization (Lines 2-913)

**When a LinkedIn profile page loads:**

1. **IIFE Wrapper** (line 2): Creates isolated scope to avoid polluting global namespace
2. **CONFIG Object** (lines 10-38): Defines all CSS selectors, timing values, and thresholds
   ```javascript
   - SELECTORS: LinkedIn DOM selectors (.feed-shared-update-v2, etc.)
   - SCROLL_WAIT_MS: 5000 (wait between scrolls)
   - BUTTON_WAIT_MS: 12000 (wait after clicking buttons)
   - MAX_NO_NEW_POSTS: 5 (stop after no new content)
   - MIN_CONTENT_LENGTH: 1 (minimum post length)
   ```

3. **Utility Functions Defined** (lines 41-258):
   - `getText()`: Safely extract text from elements
   - `parseNumber()`: Convert "1.2K" to 1200
   - `parseLinkedInDate()`: Parse LinkedIn date formats
   - `isRepost()`: Detect and filter reposts
   - `extractPostData()`: Extract data from single post element

4. **`init()` Function Executes** (line 898):
   - Checks if on LinkedIn profile page: `isLinkedInProfile()`
   - Runs extension health check: `checkExtensionHealth()`
   - Waits 2 seconds for page to stabilize
   - Creates scrape button: `createScrapeButton()`

#### Phase 2: Button Creation (Lines 411-506)

**`createScrapeButton()` injects 4 buttons into the page:**

1. **"📊 Scrape Posts"** (lines 414-434):
   - Position: `fixed, top: 80px, right: 20px`
   - Action: Triggers `handleScrapeClick()`
   - Main scraping workflow entry point

2. **"⏹️ Stop & Save"** (lines 437-458):
   - Initially hidden
   - Appears during scraping
   - Action: Triggers `handleStopAndSave()` - stops and saves current posts

3. **"📦 Download Only"** (lines 461-481):
   - Forces local file download instead of API save
   - Useful when backend is unavailable

4. **"🔄 Continue Loading"** (lines 484-505):
   - Initially hidden
   - Appears when auto-scroll thinks it reached the end
   - Allows manual retry for more posts

#### Phase 3: Main Scraping Workflow (Line 793)

**User clicks "📊 Scrape Posts" → `handleScrapeClick()` executes:**

```
handleScrapeClick() → autoScroll() → extractPosts() → sendPostsToBackground()
```

**Step-by-step execution:**

**1. UI State Update** (lines 800-812):
```javascript
- Main button text: "⏳ Scrolling..."
- Stop button: Show
- Other buttons: Hide
- Set flags: isScrapingActive = true, shouldStopScraping = false
```

**2. Auto-Scroll Phase** (lines 343-408):
```javascript
autoScroll() executes recursively:
  - Get current page height: document.documentElement.scrollHeight
  - Scroll to bottom: window.scrollTo(0, currentPageHeight)
  - Wait 5 seconds (CONFIG.SCROLL_WAIT_MS)
  - Check if page height changed
  - If no change for 3 attempts → Stop
  - If shouldStopScraping flag set → Stop
  - Update button: "📊 Scrolling... (attempt X)"
  - Repeat until stopping condition met
```

**3. Wait for Final Content** (line 818):
```javascript
- Wait 4 seconds (CONFIG.EXTRACTION_WAIT_MS)
- Ensures all lazy-loaded content is rendered
```

**4. Post Extraction Phase** (lines 261-340):
```javascript
extractPosts() workflow:

  1. Find all posts: document.querySelectorAll('.feed-shared-update-v2')

  2. For each post element:
     a. Check if repost (line 186):
        - Look for .update-components-header__text-view
        - If found → Skip this post (return null)

     b. Extract content (lines 192-193):
        - Primary: .feed-shared-update-v2__description .break-words
        - Fallback: .feed-shared-update-v2__description

     c. Extract engagement metrics (lines 198-203):
        - Likes: .social-details-social-counts__reactions-count
        - Comments: .social-details-social-counts__comments
        - Reposts: [aria-label*="repost"]
        - Convert "1.2K" to 1200 using parseNumber()

     d. Extract post URL (lines 207-225):
        - Try finding direct link: a[href*="/posts/"]
        - Fallback: Extract from data-urn attribute
        - Convert to: https://www.linkedin.com/feed/update/urn:li:activity:ID/

     e. Extract post date (lines 234-245):
        - Get datetime attribute if available
        - Otherwise parse relative dates ("2 days ago" → actual date)
        - Use parseLinkedInDate() utility

  3. Filter posts (lines 300-322):
     - Include if: content length > 1 OR has any engagement
     - Track filtering reasons for statistics
     - Log detailed filtering breakdown

  4. Return array of post objects
```

**5. Profile Info Extraction** (lines 79-86):
```javascript
getProfileInfo() extracts:
  - profileUrl: Current page URL
  - username: Extracted from URL (/in/username)
  - fullName: h1.text-heading-xlarge
  - profileImageUrl: .pv-top-card-profile-picture__image src
```

**6. Send to Background Script** (lines 684-790):
```javascript
sendPostsToBackground(profileInfo, posts):

  1. Check Chrome runtime availability (lines 689-705):
     - Verify: chrome.runtime && chrome.runtime.sendMessage
     - Retry up to 3 times if unavailable

  2. Send message to background script (lines 715-718):
     chrome.runtime.sendMessage({
       action: 'scrapeProfile',
       profileInfo: { profileUrl, username, fullName, profileImageUrl },
       posts: [ { content, likes, comments, reposts, linkedinPostUrl, postDate }, ... ]
     }, callback)

  3. Handle response (lines 722-788):
     - Success: Update button "✅ X posts saved!"
     - Error: Show error message, try fallback download
     - Fallback: saveDataAsDownload() creates local JSON file
```

#### Phase 4: SPA Navigation Handling (Lines 919-926)

**MutationObserver watches for URL changes:**
```javascript
- LinkedIn is a single-page app (SPA)
- Observer detects navigation without page reload
- Re-runs init() when URL changes
- Ensures button appears on newly visited profiles
```

---

### BACKGROUND.JS - Execution Flow

The background service worker acts as the "brain" of the extension, handling API communication and tab management.

#### Phase 1: Extension Installation (Line 245)

**When extension is first installed or updated:**
```javascript
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Post Scraper extension installed');
})
```

#### Phase 2: Configuration (Lines 15-16)

**Constants defined:**
```javascript
DASHBOARD_URL = 'https://kleo-rip.vercel.app/dashboard'
API_BASE_URL = 'http://localhost:3000/api'
```

#### Phase 3: Message Listener (Line 33)

**Always listening for messages from content.js:**
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  1. Log received message

  2. Check if action === 'scrapeProfile'

  3. Call handleScrapeProfile(profileInfo, posts)

  4. Return result via sendResponse()

  5. Return true to keep message channel open for async response
})
```

#### Phase 4: Scrape Profile Workflow (Line 73)

**`handleScrapeProfile(profileInfo, posts)` executes:**

```
handleScrapeProfile() → saveProfileToStorage() → sendPostsToAPI() → openDashboard()
```

**Step-by-step execution:**

**1. Save Profile to Chrome Storage** (lines 83, 175-182):
```javascript
saveProfileToStorage(profileInfo):
  - Store in chrome.storage.local
  - Key: profile_{username}
  - Value: { ...profileInfo, lastAccessed: Date.now() }
  - Allows tracking recently scraped profiles
```

**2. Send Posts to API** (lines 92, 124-162):
```javascript
sendPostsToAPI(profileInfo, posts):

  1. Make POST request to http://localhost:3000/api/scrape-local

  2. Request body:
     {
       "profileInfo": {
         "profileUrl": "https://linkedin.com/in/username",
         "username": "username",
         "fullName": "Full Name",
         "profileImageUrl": "..."
       },
       "posts": [
         {
           "content": "Post text...",
           "likes": 123,
           "comments": 45,
           "reposts": 12,
           "linkedinPostUrl": "https://...",
           "postDate": "2024-01-14T00:00:00.000Z"
         },
         ...
       ]
     }

  3. API saves to local files:
     - scraped-data/profiles/{username}_{timestamp}.json
     - scraped-data/posts/{username}_{timestamp}_posts.json

  4. Return result:
     {
       postsCount: 45,
       method: 'local-files',
       files: { profileFile: '...', postsFile: '...' },
       message: 'Saved to local files'
     }
```

**3. Open Dashboard** (lines 97, 194-200):
```javascript
openDashboard(profileUrl):
  - Create new tab
  - URL: https://kleo-rip.vercel.app/dashboard?profile={encoded_url}
  - Set active: true (brings tab to front)
```

**4. Send Response Back** (lines 40-47):
```javascript
- Success: sendResponse({ success: true, data: result })
- Error: sendResponse({ success: false, error: message })
```

#### Phase 5: Icon Click Handler (Line 214)

**When user clicks extension icon:**
```javascript
chrome.action.onClicked.addListener((tab) => {

  If on LinkedIn profile page (linkedin.com/in/):
    → Inject content.js script

  Else:
    → Open dashboard in new tab
})
```

---

### Communication Flow Diagram

```
┌─────────────────────────────────────┐          ┌───────────────────────────────┐
│       CONTENT.JS                    │          │      BACKGROUND.JS            │
│    (LinkedIn Profile Page)          │          │    (Service Worker)           │
└─────────────────────────────────────┘          └───────────────────────────────┘
              │                                              │
              │ 1. Page loads                                │
              ├──> init()                                    │
              ├──> createScrapeButton()                      │
              │                                              │
              │ 2. User clicks "📊 Scrape Posts"            │
              ├──> handleScrapeClick()                       │
              ├──> autoScroll()                              │
              │    └──> Scroll & wait loop                   │
              ├──> extractPosts()                            │
              │    └──> Parse DOM, filter reposts            │
              ├──> getProfileInfo()                          │
              │                                              │
              │ 3. Send message to background                │
              ├─────────────────────────────────────────────►│
              │    chrome.runtime.sendMessage({              │
              │      action: 'scrapeProfile',                │
              │      profileInfo: {...},                     │
              │      posts: [...]                            │
              │    })                                        │
              │                                              │
              │                      4. Handle message       │
              │                      ├──> handleScrapeProfile()
              │                      ├──> saveProfileToStorage()
              │                      │     └─ chrome.storage.local
              │                      │                       │
              │                      ├──> sendPostsToAPI()   │
              │                      │     └─ POST to        │
              │                      │        localhost:3000/api/scrape-local
              │                      │        ├─ Save to     │
              │                      │        │  scraped-data/profiles/
              │                      │        └─ Save to     │
              │                      │           scraped-data/posts/
              │                      │                       │
              │                      └──> openDashboard()    │
              │                            └─ chrome.tabs.create()
              │                                              │
              │ 5. Receive response                          │
              │◄─────────────────────────────────────────────┤
              │    sendResponse({                            │
              │      success: true,                          │
              │      data: { postsCount: 45, ... }           │
              │    })                                        │
              │                                              │
              │ 6. Update UI                                 │
              ├──> Button: "✅ 45 posts saved!"              │
              │                                              │
```

---

### Key Design Decisions

1. **No Dependencies**: Pure vanilla JavaScript for maximum compatibility and minimal overhead
2. **DOM-Based Scraping**: Uses LinkedIn's existing HTML structure instead of API calls
3. **Fallback Mechanisms**: Download-to-file fallback if extension/API fails
4. **Repost Filtering**: Automatically excludes reposts to focus on original content
5. **Smart Scrolling**: Detects when no new content loads to avoid infinite loops
6. **User Control**: Stop button allows manual interruption and saving
7. **Local File Storage**: Development mode saves to JSON files for testing without database

### Error Handling Strategy

**Content Script:**
- Retries Chrome runtime connection up to 3 times
- Falls back to local file download if extension fails
- Validates profile page before initializing
- Gracefully handles missing DOM elements

**Background Script:**
- Keeps message channel open for async operations
- Logs all API responses for debugging
- Handles network failures gracefully
- Validates data before sending to API

---

## Deployment Notes

### For Vercel Deployment
You need these environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 
- `SUPABASE_SERVICE_ROLE_KEY`

### Build Issues Fixed
- Removed `!` assertions from environment variables 
- Added runtime validation for Supabase client
- Changed `supabaseAdmin` to `getSupabaseAdmin()` function

## Next Steps
1. Test scraper functionality with local files
2. Verify data quality and completeness
3. Debug any extraction issues
4. Once working, can switch back to Supabase for production

## Recent Updates

### Phase 1: Enhanced Post Collection & Logging
- **Increased ineffective click limit** from 3 to 7 attempts
- **Increased wait time** from 5 to 8 seconds after button clicks
- **Relaxed content filtering** from 20 to 5 characters minimum
- **Added detailed logging** to track filtering decisions and statistics
- **Enhanced engagement detection** - includes ANY engagement (likes OR comments OR reposts)

### Fixed Infinite Scroll Issue
- **Problem**: Scraper would get stuck clicking "Show more" buttons that don't load new content
- **Solution**: Added ineffective click detection - stops after button clicks that don't load new posts
- **Added**: "Stop & Save" button to manually stop scraping and save current posts

### Improved Error Handling
- Better Chrome extension runtime detection
- More robust communication between content script and background script
- Graceful handling of scraping interruptions

## Controls
- **📊 Scrape Posts**: Start full scraping with auto-scroll
- **⏹️ Stop & Save**: Stop current scraping and save posts found so far

## Notes
- Scraped JSON files are ignored by git (see .gitignore)
- Use pnpm as package manager (not npm)
- Extension uses Manifest V3
- Chrome extension communicates with local API on localhost:3002 (updated from 3000)
- Extension will stop after 3 ineffective "Show more" button clicks
- Manual stop option available during scraping