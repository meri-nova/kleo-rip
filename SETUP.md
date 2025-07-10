# LinkedIn Post Scraper - Complete Setup Guide

## Prerequisites
- Node.js installed on your machine
- Chrome browser
- Supabase account (already set up ✅)

## Step 1: Install Dependencies

Try one of these methods to fix npm cache issues:

### Option A: Fix npm cache (if you have sudo access)
```bash
sudo chown -R $(whoami) ~/.npm
npm install
```

### Option B: Use npm with --force flag
```bash
npm install --force
```

### Option C: Manual dependency installation
If npm still fails, create the node_modules manually:
1. Delete existing node_modules: `rm -rf node_modules`
2. Try: `npm install --no-package-lock`

## Step 2: Start the Application

```bash
cd linkedin-scraper
npm run dev
```

Your app should be running at: http://localhost:3000

## Step 3: Install Chrome Extension

1. Open Chrome and go to: `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `chrome-extension` folder from this project
5. Extension should appear in your list

### Create Extension Icons (Optional)
1. Open `chrome-extension/create-icons.html` in browser
2. Right-click each canvas and "Save image as..." to `chrome-extension/icons/`
3. Save as: `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`

## Step 4: Test the System

### Test 1: Basic Dashboard
1. Visit: http://localhost:3000/dashboard
2. Should see "No profile URL provided" message ✅

### Test 2: Extension Detection
1. Visit any LinkedIn profile: `linkedin.com/in/username`
2. Look for blue "📊 Scrape Posts" button (top right)
3. If button missing, refresh page or check console for errors

### Test 3: Full Scraping Flow
1. On LinkedIn profile, click "📊 Scrape Posts"
2. New tab should open with dashboard
3. Should see "Scraping..." progress
4. Mock posts should appear after 3-5 seconds

## Current System Status

### ✅ Working Components
- Next.js app with API routes
- Supabase database connection
- Chrome extension injection
- Dashboard UI with sorting/filtering
- Caching system (24-hour refresh)

### 🔄 DOM Extraction System
- Uses Chrome extension to extract posts directly from LinkedIn DOM
- Real engagement metrics (likes, comments, reposts)

### 📋 Database Tables Created
- `profiles` - LinkedIn profile info
- `posts` - Post content and engagement metrics  
- `scrape_jobs` - Scraping progress tracking

## Troubleshooting

### Extension Issues
- **Button not appearing**: Refresh LinkedIn page, check URL has `/in/`
- **Extension errors**: Check Chrome console, reload extension
- **API errors**: Make sure Next.js is running on port 3000

### Next.js Issues
- **Port 3000 busy**: Change port in package.json or kill process
- **Supabase errors**: Check .env.local file has correct keys
- **TypeScript errors**: Install missing dependencies

### Database Issues
- **Tables missing**: Run the SQL setup script in Supabase dashboard
- **Connection errors**: Verify environment variables
- **Permission errors**: Check Supabase RLS policies

## Next Steps

1. **Test DOM extraction** on various LinkedIn profiles
2. **Improve engagement metrics accuracy** with better selectors
3. **Add more filtering options** (date ranges, post types)
4. **Deploy to production** (Vercel + Chrome Web Store)

## File Structure Overview

```
linkedin-scraper/
├── src/
│   ├── app/
│   │   ├── api/scrape/route.ts          # Main scraping endpoint
│   │   ├── api/posts/route.ts           # Get posts with filtering
│   │   └── dashboard/page.tsx           # Main dashboard UI
│   └── lib/supabase.ts                  # Database client
├── chrome-extension/
│   ├── manifest.json                    # Extension config
│   ├── content.js                       # LinkedIn page injection
│   ├── background.js                    # API communication
│   ├── popup.html/js                    # Extension popup
│   └── README.md                        # Extension setup guide
└── .env.local                          # API keys (already set ✅)
```

## Support

If you run into issues:
1. Check console logs (F12 in browser)
2. Verify all services are running
3. Test API endpoints directly in browser
4. Review this setup guide step by step