# Firmadeal: Institutional Data Extraction Engine

A deterministic data extraction layer that bridges unstructured public information and automated valuation modeling. This is the foundational data ingestion system for your lead generation and microeconomic moat assessment pipeline.

## The Architecture We Are Building

We are constructing the **foundational data ingestion layer** for your Firmadeal lead generation system. The engine mechanically isolates proxy variables from unstructured web interfaces—turning dynamic public information into structured, actionable datasets.

By capturing review volume, categorical classification, spatial coordinates, and contact vectors, we bypass the need for proprietary financial statements in the initial outreach phase. This structured JSON output becomes the direct feed for your valuation algorithms and the final PDF rendering engine.

**You are effectively building an automated investment analyst capable of evaluating microeconomic moats at scale.**

### Strategic Value of Extracted Metrics

| Metric | Strategic Use | Model Application |
|--------|---------------|--------------------|
| **review_volume** | Cash flow multiplier proxy | EBITDA multiple cross-reference |
| **category** | Business segmentation | Industry classification & benchmarking |
| **rating** | Quality/demand signal | Risk assessment & market position |
| **latitude/longitude** | Geographic intelligence | Regional demographic mapping & isochrone analysis |
| **address** | Sales sequence vector | Direct outreach targeting |
| **phone** | Operational contact point | Lead generation pipeline |

### Deterministic Extraction Process

1. **Input**: Google Maps shortened link (e.g., `https://maps.app.goo.gl/aEhAJeQvLueyFUcr6`)
2. **Processing**: Headless browser extracts metrics via ARIA labels and DOM parsing
3. **Output**: Structured JSON with institutional-grade data fields
4. **Integration**: Feed directly into valuation models, demographic analysis, and sales sequences

## Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
playwright install
```

### 2. Add Your Google Maps Link

Edit `extraction_script.py` and replace `INSERT_URL_HERE` with your target link:
- Shortened links: `https://maps.app.goo.gl/aEhAJeQvLueyFUcr6`
- Full Google Maps URLs: `https://www.google.com/maps/place/...`

## Local Usage

```bash
python extraction_script.py
```

The script will:
- Navigate to the Google Maps link (auto-handles redirects)
- Extract metrics via ARIA labels (DOM-resistant)
- Parse coordinates from the resolved URL
- Extract address and phone for sales sequences
- Output results to `institutional_target.json` and console

## Online Deployment (Vercel)

This extraction engine is deployed as a serverless function on Vercel for instant access without local setup.

### Deploy in 3 Steps

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy to Vercel**
   ```bash
   npm install
   vercel deploy
   ```

3. **Access Your App**
   - Vercel will provide your deployment URL
   - Navigate to the URL and start extracting data
   - Web interface handles all extraction requests

### What's Deployed

- **Next.js Frontend**: Fast, responsive web interface
- **API Endpoints**: `/api/extract` handles all extraction requests
- **Playwright Browser**: Runs in serverless functions for headless extraction
- **Automatic Scaling**: Vercel handles traffic automatically

### Environment & Configuration

The `vercel.json` file configures:
- Build command for Next.js compilation
- Output directory for production
- Playwright browser binary handling

### Using the Web Interface

1. **Paste Your Google Maps Link**
   - Shortened: `https://maps.app.goo.gl/...`
   - Full URL: `https://www.google.com/maps/place/...`

2. **Click "Extract Data"**
   - Watch real-time extraction progress
   - Results appear instantly upon completion

3. **Download Results**
   - Click "Download JSON" to save the structured data
   - Use in your valuation pipelines immediately

### Batch Processing (Advanced)

For processing multiple locations, integrate with your pipeline:

```bash
# Example: Extract multiple locations
for url in "https://maps.app.goo.gl/..." "https://maps.app.goo.gl/..."; do
  curl -X POST https://your-vercel-app.vercel.app/api/extract \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$url\"}" >> results.jsonl
done
```

## Extracted Data Structure

```json
{
  "name": "Business Name",
  "category": "Restaurant > Italian",
  "rating": "4.5 stars (based on 324 reviews)",
  "review_volume": "324 reviews",
  "address": "123 Main St, New York, NY 10001",
  "phone": "+1 (212) 555-0123",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "resolved_url": "https://www.google.com/maps/place/..."
}
```

## Extraction Architecture

This implementation prioritizes **systemic stability** over class selectors:

| Data Point | Method | Stability | Use Case |
|-----------|--------|-----------|----------|
| Business Name | H1 selector | Very High | Identification |
| Category | jsaction selector | High | Segmentation |
| Average Rating | ARIA label `[aria-label*='stars']` | Very High | Quality signal |
| Review Volume | ARIA label `button[aria-label*='reviews']` | Very High | Demand proxy |
| Address | data-item-id selector | High | Sales outreach |
| Phone | data-item-id selector | High | Contact vector |
| Coordinates | URL regex parsing `@lat,lng` | Highest | Geographic analysis |

## Integration with Valuation Models

### Cash Flow Estimation
Review volume serves as a direct proxy for demand elasticity. Cross-reference against your internal EBITDA multiples for rapid valuation:

```
Estimated EBITDA Multiple = Base Multiple × (Review_Count / Benchmark_Count)
Enterprise Value = Estimated Revenue × Multiple
```

### Geographic Analysis
Latitude/longitude enable isochrone mapping against regional demographic trends:
- Population density heatmaps
- Income distribution analysis
- Competitor proximity mapping
- Market saturation analysis

### Sales Sequence Integration
Address and phone provide exact contact vectors for your outreach automation:
- Direct dialing
- Direct mail campaigns
- Email enrichment
- CRM integration

## Production Considerations

For long-term institutional tracking that requires zero data loss:
- **Google Places API** - Official structured endpoint with SLAs
- **Apify Google Maps Extractor** - Maintained third-party service
- **Outscraper** - Enterprise-grade scraping infrastructure

This local extraction works well for ad-hoc analysis and development. For continuous institutional monitoring at scale, migrate to API-based solutions that guarantee DOM stability across updates.

## Technology Stack

- **Playwright** - Headless browser automation
- **Python 3.x** - Async extraction logic
- **Vercel** - Serverless deployment
- **JSON** - Structured output format


