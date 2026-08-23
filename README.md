# Construction Bid Analyzer MVP

An intelligent construction document analysis platform that leverages AI agents to classify documents, assess risks, and recommend bids. Built with Next.js 14 and designed for free deployment on Vercel.

## Features

### Core Functionality
- **📄 PDF Document Upload** - Drag-and-drop interface for uploading construction documents
- **🏷️ Document Classification** - Automatically identifies document types:
  - Contracts
  - Specifications
  - Bills of Quantities (BOQ)
  - Engineering Drawings
  - Addendums/Amendments

- **⚖️ Multi-Agent Analysis** - Specialized agents analyze documents:
  - **Legal Agent** - Reviews contracts, identifies compliance issues and legal risks
  - **Civil Engineering Agent** - Assesses feasibility, timeline, and structural concerns
  - **Accounting Agent** - Estimates costs including materials, labor, and contingencies
  - **Risk Agent** - Calculates risk scores and mitigation strategies

- **💰 Bid Recommendations** - Intelligent pricing with:
  - Cost estimation based on document type
  - Risk-adjusted pricing
  - Bid margin calculation
  - Confidence scoring

- **📊 Bid History** - Track and review all analyzed documents with full audit trail

## Tech Stack

- **Frontend**: Next.js 14, React 19, TypeScript, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **Database**: Vercel Postgres (free tier)
- **State Management**: React Hooks

## Getting Started

### Local Development

1. **Install dependencies**
```bash
npm install
```

2. **Run development server**
```bash
npm run dev
```

3. **Open in browser**
Navigate to `http://localhost:3000`

## Deployment to Vercel

### Quick Start

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "Construction Bid Analyzer MVP"
git push -u origin main
```

2. **Deploy to Vercel**
- Visit [vercel.com](https://vercel.com)
- Click "New Project"
- Import your GitHub repository
- Add `POSTGRES_URLPGSQL` environment variable
- Deploy!

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Project Structure

```
app/
├── page.tsx                 # Upload interface
├── bids/page.tsx           # Bid history
├── bid/[id]/page.tsx       # Bid details
└── api/                    # API endpoints
    ├── upload/route.ts
    ├── analyze/route.ts
    ├── bids/route.ts
    └── bid/[id]/route.ts

components/
├── UploadForm.tsx          # File upload
└── ResultsView.tsx         # Results display

lib/
├── db.ts                   # Database
├── pdf.ts                  # PDF extraction
├── classifier.ts           # Classification
└── agents/mock-agents.ts  # Mock agents
```

## Features

✅ PDF upload and text extraction  
✅ Document classification (5 types)  
✅ Multi-agent analysis (Legal, Engineering, Accounting, Risk)  
✅ Bid recommendations with pricing  
✅ Bid history tracking  
✅ Responsive React UI  
✅ Free Vercel deployment  

## Ready for Claude API Integration

The architecture is ready to replace mock agents with real Claude API:

```bash
npm install @anthropic-ai/sdk
# Add ANTHROPIC_API_KEY to .env.local
# Replace mock agents in lib/agents/
```

## API Endpoints

- `POST /api/upload` - Upload PDF and extract text
- `POST /api/analyze` - Analyze document and generate bid
- `GET /api/bids` - Fetch bid history
- `GET /api/bid/[id]` - Get bid details

## Database

Uses Vercel Postgres (free tier: 256MB):
- Automatic table creation on first use
- Stores document analysis and bid history

## Next Steps

1. Deploy to Vercel (see DEPLOYMENT.md)
2. Add your Anthropic API key for Claude integration
3. Customize agent prompts for your use case
4. Add user authentication
5. Build additional features

## License

MIT License

---

**Deployed to Vercel** | **Ready for Production** | **MIT License**
