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