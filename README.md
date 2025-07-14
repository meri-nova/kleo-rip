# 📊 LinkedIn Post Scraper

A powerful Chrome extension and web application that scrapes LinkedIn posts and analyzes their engagement metrics. Built with Next.js, Supabase, and Chrome Extension APIs.

## ✨ Features

- **🎯 One-Click Scraping**: Chrome extension injects a button directly on LinkedIn profiles
- **📈 Engagement Analytics**: Sort posts by likes, comments, reposts, and views
- **⏰ Smart Caching**: Avoids re-scraping with 24-hour cache system
- **🎨 Clean Dashboard**: Modern UI with filtering and sorting capabilities
- **🔄 Real-time Updates**: Live progress tracking during scraping
- **📱 Responsive Design**: Works on desktop and mobile

## 🏗️ Architecture

### Frontend
- **Next.js 15** with App Router and TypeScript
- **Tailwind CSS** for styling
- **React** for interactive UI components

### Backend
- **Next.js API Routes** for scraping endpoints
- **Supabase** for database and authentication
- **PostgreSQL** for data storage

### Chrome Extension
- **Manifest V3** for modern Chrome compatibility
- **Content Scripts** for LinkedIn page injection
- **Background Service Worker** for API communication

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- pnpm installed (`npm install -g pnpm`)
- Chrome browser
- Supabase account

### 1. Clone and Install
```bash
git clone https://github.com/yourusername/linkedin-scraper.git
cd linkedin-scraper
pnpm install
```

### 2. Environment Setup
Create `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### 3. Database Setup
In your Supabase dashboard SQL editor, run the schema from `setup-db.sql`:
1. Go to your Supabase project dashboard
2. Click "SQL Editor" 
3. Copy and paste the contents of `setup-db.sql`
4. Click "Run" to create the tables

### 4. Start Development Server
```bash
pnpm dev
```
Visit: http://localhost:3000

### 5. Install Chrome Extension
1. Open Chrome → `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `chrome-extension` folder

## 📖 Usage

### Method 1: Direct LinkedIn Integration
1. Visit any LinkedIn profile (`linkedin.com/in/username`)
2. Look for the blue "📊 Scrape Posts" button
3. Click to start scraping and open dashboard

### Method 2: Extension Popup
1. Click extension icon in Chrome toolbar
2. Use popup interface to manage profiles

## 🗂️ Project Structure

```
linkedin-scraper/
├── src/
│   ├── app/
│   │   ├── api/             # Next.js API routes
│   │   │   ├── scrape/      # Main scraping endpoint
│   │   │   └── posts/       # Post retrieval with filtering
│   │   └── dashboard/       # Main dashboard UI
│   └── lib/
│       └── supabase.ts      # Database client
├── chrome-extension/
│   ├── manifest.json        # Extension configuration
│   ├── content.js          # LinkedIn page injection
│   ├── background.js       # API communication
│   └── popup.html/js       # Extension popup UI
└── database/
    └── setup-db.sql        # Database schema
```

## 🔧 API Endpoints

### POST `/api/scrape`
Start scraping a LinkedIn profile
```json
{
  "linkedinUrl": "https://linkedin.com/in/username"
}
```

### GET `/api/posts?profileUrl=...&sortBy=likes&timeframe=30d`
Retrieve posts with filtering options

### GET `/api/scrape/status/[jobId]`
Check scraping job progress

## 🎯 Database Schema

### Tables
- **profiles**: LinkedIn profile information
- **posts**: Scraped post content and engagement metrics
- **scrape_jobs**: Background job tracking

## 🔒 Security & Privacy

- **No Data Mining**: Only scrapes when explicitly requested by user
- **Local Processing**: All scraping happens on your own infrastructure
- **Environment Variables**: Sensitive keys stored securely
- **Rate Limiting**: Respects LinkedIn's usage policies

## 🛠️ Development

### Package Management
This project uses pnpm as the package manager. The `pnpm-lock.yaml` file should be committed to version control to ensure consistent dependency versions across environments.

### Running Tests
```bash
pnpm test
```

### Building for Production
```bash
pnpm build
```

### Extension Development
1. Make changes to `chrome-extension/` files
2. Go to `chrome://extensions/`
3. Click refresh icon on the extension
4. Test changes

## 🚀 Deployment

### Web App to Vercel
1. **Connect to Vercel**:
   - Push your code to GitHub/GitLab
   - Connect your repository to Vercel
   - Or use Vercel CLI: `npx vercel`

2. **Environment Variables in Vercel**:
   Set these in your Vercel project settings:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key  
   SUPABASE_SERVICE_ROLE_KEY=your_service_key
   ```

3. **Deploy**:
   - Vercel will automatically build and deploy
   - Your app will be available at `your-project.vercel.app`

### Chrome Extension (Production)
1. Build extension package from `chrome-extension/` folder
2. Update `chrome-extension/background.js` API URL to your Vercel domain
3. Submit to Chrome Web Store
4. Wait for approval (5-7 days)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📋 Roadmap

- [ ] Enhanced DOM extraction accuracy
- [ ] Advanced analytics and insights
- [ ] Export functionality (CSV, PDF)
- [ ] Multi-profile comparison
- [ ] Engagement trend analysis
- [ ] Chrome Web Store publication

## 🐛 Troubleshooting

See [SETUP.md](SETUP.md) for detailed setup instructions and troubleshooting guide.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This tool is for educational and personal use only. Always respect LinkedIn's Terms of Service and rate limits. Use responsibly and ethically.