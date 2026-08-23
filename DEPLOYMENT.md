# Construction Bid Analyzer - Deployment Guide

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL (for local database) or Vercel Postgres account

### Setup

1. **Install dependencies**
```bash
npm install
```

2. **Set up environment variables**
Create a `.env.local` file with your database connection:
```
POSTGRES_URLPGSQL="postgresql://user:password@localhost:5432/bid_analyzer"
```

3. **Run the development server**
```bash
npm run dev
```

4. **Open in browser**
Visit `http://localhost:3000`

## Deployment to Vercel (Free Tier)

### Prerequisites
- Vercel account (free)
- GitHub account with repository

### Steps

1. **Push code to GitHub**
```bash
git add .
git commit -m "Initial commit: Construction Bid Analyzer MVP"
git push origin main
```

2. **Connect to Vercel**
- Go to [vercel.com](https://vercel.com)
- Sign up or log in
- Click "New Project"
- Import your GitHub repository
- Select the repository and click "Import"

3. **Configure Environment Variables in Vercel Dashboard**
- In Project Settings → Environment Variables
- Add your database connection string:
  - Key: `POSTGRES_URLPGSQL`
  - Value: Your Vercel Postgres connection string

4. **Set up Database**
- Option A: Use Vercel Postgres (recommended for free tier)
  - In Vercel dashboard, go to Storage → Create Database → Postgres
  - Copy the connection string and add to environment variables
  - The database tables will be created on first use

- Option B: Use your own PostgreSQL
  - Ensure your database is accessible from Vercel
  - Add connection string to environment variables

5. **Deploy**
- Once environment variables are set, Vercel will automatically deploy
- Your app will be live at `https://your-project.vercel.app`

## Features

### Current MVP Features
- ✅ PDF document upload and text extraction
- ✅ Document classification (CONTRACT, SPECIFICATION, BOQ, DRAWING, ADDENDUM)
- ✅ Multi-agent analysis:
  - Legal Agent
  - Civil Engineering Agent
  - Accounting Agent
  - Risk Agent
- ✅ Bid recommendation with pricing
- ✅ Bid history tracking
- ✅ Responsive UI with React + Tailwind CSS

### Future Enhancements
- 🔜 Real Claude API integration for document understanding
- 🔜 User authentication
- 🔜 Collaborative bid review
- 🔜 PDF annotation and markup
- 🔜 Advanced filtering and search
- 🔜 Export bid reports (PDF, Excel)

## Architecture

### Frontend
- **Framework**: Next.js 14 (React)
- **Styling**: Tailwind CSS
- **State Management**: React Hooks

### Backend
- **Runtime**: Vercel Serverless Functions
- **API Routes**: 
  - `POST /api/upload` - File upload and text extraction
  - `POST /api/analyze` - Document analysis orchestration
  - `GET /api/bids` - Fetch bid history
  - `GET /api/bid/:id` - Get bid details

### Database
- **Type**: PostgreSQL (Vercel Postgres free tier)
- **ORM**: Raw SQL with @vercel/postgres

### Mock Agents
Currently using mock implementations that return templated responses based on document type. Ready for Claude API integration.

## Free Tier Limits

### Vercel
- **Bandwidth**: 100GB/month
- **Functions**: 10 per project
- **Execution Time**: 10 seconds per function
- **Concurrent Functions**: Limited

### Vercel Postgres (Free Tier)
- **Storage**: Starts at 256 MB
- **Transactions**: 2.5M per month
- **Backups**: 7-day retention

## Cost Estimation

- **Vercel Hosting**: Free tier (no cost)
- **Vercel Postgres**: Free tier (up to 256MB)
- **Claude API** (optional future integration): ~$0.003 per 1K input tokens

## Troubleshooting

### Database Connection Issues
```
Error: "Unable to connect to database"
```
- Verify POSTGRES_URLPGSQL is set correctly in Vercel
- Ensure database is accessible (check firewall/security groups)
- Test connection string locally first

### File Upload Not Working
- Check file size limits (free tier: 10MB per function)
- Verify PDF file is valid
- Check browser console for detailed errors

### Slow Performance
- Optimize images and assets
- Use Vercel's Analytics to identify bottlenecks
- Upgrade database tier if needed

## Monitoring

Monitor your deployment:
1. Vercel Dashboard → Analytics
2. Check function execution times
3. Monitor database usage
4. Review error logs

## Support

For issues:
1. Check Vercel documentation: https://vercel.com/docs
2. Review Next.js docs: https://nextjs.org/docs
3. Check PostgreSQL docs: https://www.postgresql.org/docs

## License

MIT License - Feel free to use and modify for your needs
