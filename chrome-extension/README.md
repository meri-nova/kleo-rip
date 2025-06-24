# LinkedIn Post Scraper Chrome Extension

## Installation

### 1. Enable Developer Mode in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Toggle "Developer mode" ON (top right corner)

### 2. Load Unpacked Extension
1. Click "Load unpacked" button
2. Select the `chrome-extension` folder from this project
3. Extension should appear in your extensions list

### 3. Pin Extension (Optional)
1. Click the puzzle piece icon in Chrome toolbar
2. Pin "LinkedIn Post Scraper" for easy access

## Usage

### Method 1: Direct Button on LinkedIn
1. Visit any LinkedIn profile page (linkedin.com/in/username)
2. Look for the blue "📊 Scrape Posts" button (top right)
3. Click the button to start scraping
4. Dashboard will open automatically

### Method 2: Extension Popup
1. Click the extension icon in toolbar
2. If on LinkedIn profile: click "Scrape This Profile"
3. If not on LinkedIn: click "Open Dashboard"

## How It Works

1. **On LinkedIn Profile Pages**: Extension injects a scrape button
2. **When Clicked**: Extracts profile information (name, URL, etc.)
3. **Sends Request**: Makes API call to your Next.js app (localhost:3000)
4. **Opens Dashboard**: Shows scraping progress and results
5. **Stores Data**: Caches profile info for quick access

## Requirements

- Chrome browser
- Next.js app running on localhost:3000
- LinkedIn profile pages (linkedin.com/in/*)

## Troubleshooting

### Extension Not Working
- Check if Developer mode is enabled
- Reload extension after code changes
- Check Chrome console for errors

### API Errors
- Make sure Next.js app is running (`npm run dev`)
- Check if localhost:3000 is accessible
- Verify Supabase connection

### LinkedIn Button Missing
- Refresh the LinkedIn page
- Check if URL contains `/in/` (profile page)
- Try disabling other LinkedIn extensions

## Development

### Making Changes
1. Edit files in `chrome-extension/` folder
2. Go to `chrome://extensions/`
3. Click refresh icon on the extension
4. Test changes on LinkedIn

### Debugging
- Right-click extension → "Inspect popup" (for popup.js)
- F12 on LinkedIn page → Console (for content.js)
- chrome://extensions → "background page" (for background.js)