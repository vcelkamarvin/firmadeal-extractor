# Quick Start Guide

## Local Development

### 1. Install Dependencies
```bash
cd "/Users/albertlaurin/Desktop/untitled folder"
npm install
```

### 2. Run Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### 3. Test Extraction
- Navigate to the web interface
- Paste a Google Maps link (e.g., `https://maps.app.goo.gl/aEhAJeQvLueyFUcr6`)
- Click "Extract Data"
- Download the results as JSON

## Deploy to Vercel

### 1. Install Vercel CLI (if needed)
```bash
npm install -g vercel
```

### 2. Deploy
```bash
vercel
```

Follow the prompts to connect your GitHub and deploy.

### 3. Access Your App
Vercel will provide a live URL. Your extraction engine is instantly available online!

## Architecture Overview

### Components

**Frontend** (`app/page.tsx`)
- React component with modern UI
- Real-time extraction status
- JSON download functionality
- Responsive design for mobile/desktop

**API Route** (`app/api/extract/route.ts`)
- Node.js/Playwright implementation
- Handles incoming extraction requests
- Returns structured JSON
- Error handling and logging

**Original Python Script** (`extraction_script.py`)
- Standalone CLI version
- Useful for local batch processing
- Reference implementation

### Data Flow

```
User Input (Web or API)
    ↓
Vercel Serverless Function
    ↓
Playwright Browser (Headless)
    ↓
DOM Extraction (ARIA labels + selectors)
    ↓
URL Regex Parsing (coordinates)
    ↓
Structured JSON Output
    ↓
Valuation Pipeline Integration
```

## Key Files

| File | Purpose |
|------|---------|
| `app/page.tsx` | Main web interface component |
| `app/api/extract/route.ts` | API endpoint for extraction |
| `app/layout.tsx` | Root layout with metadata |
| `app/globals.css` | Global styles |
| `package.json` | Next.js dependencies & scripts |
| `vercel.json` | Vercel deployment config |
| `tsconfig.json` | TypeScript configuration |
| `extraction_script.py` | Standalone Python script |
| `README.md` | Full documentation |

## Environment Variables

Currently, no environment variables are required. The Playwright binary will be automatically installed during deployment.

## Troubleshooting

### Issue: "Playwright not installed"
**Solution**: Run `npm install` again, or redeploy to Vercel

### Issue: Extraction timeout (>30s)
**Solution**: This is typical for cold starts on Vercel. Subsequent requests are faster.

### Issue: Selectors not matching
**Solution**: Google Maps frequently updates their DOM. Check the extraction logs for clues, or adjust selectors in `app/api/extract/route.ts`

## Next Steps

1. **Deploy to Vercel** - Make it accessible online
2. **Integrate with your pipeline** - Post to `/api/extract` endpoint
3. **Add database** - Store extraction results for analysis
4. **Build valuation models** - Use the JSON output in your algorithms
5. **Scale batch processing** - Process multiple locations automatically

---

For more details, see [README.md](README.md)
