# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Moadamda Analytics** is a Matomo-based analytics platform specialized for e-commerce, designed to replace GA4. It tracks visitor behavior, e-commerce events, and provides advanced marketing attribution analysis for an online shopping mall.

- **Production Server**: 211.188.53.220 (Naver Cloud)
- **Production URLs**:
  - Backend API: https://marketingzon.com
  - Dashboard: https://dashboard.marketingzon.com
- **Local Development**:
  - Backend API: http://localhost:3003
  - Dashboard: http://localhost:3030

## System Architecture

### Three-Tier Architecture

1. **Tracker (Client-side JavaScript)**
   - Location: `tracker/src/tracker.js`
   - Vanilla JavaScript tracking script deployed to Cafe24 shopping mall
   - Tracks pageviews, sessions, e-commerce events (view_product, add_to_cart, checkout, purchase)
   - Sends data to backend API via POST requests

2. **Backend (Node.js API)**
   - Location: `backend/src/`
   - Tech Stack: Node.js, Express, PostgreSQL
   - Main Routes:
     - `/api/track` - Data collection endpoint (track.js)
     - `/api/stats/*` - Analytics data endpoints (stats.js)
     - `/api/tables/*` - Raw data table views (tables.js)
     - `/api/mappings/*` - URL/product mapping management (mappings.js)
     - `/api/creative-performance/*` - Ad creative analysis (creative-performance.js)

3. **Frontend (React Dashboard)**
   - Location: `frontend/src/`
   - Tech Stack: React, Vite, Ant Design, Recharts, TailwindCSS
   - Main Pages:
     - `App.jsx` - Main dashboard with metrics, UTM performance, order analysis
     - `DataTables.jsx` - Raw data table views
     - `CreativePerformance.jsx` - Ad creative population analysis
     - `OrderAnalysis.jsx` - Individual order journey analysis
     - `PageMapping.jsx` - URL to product name mapping management

### Database Schema (PostgreSQL)

Core tables in `backend/migrations/init.sql`:
- `visitors` - Unique visitors with device info, UTM parameters
- `sessions` - User sessions with duration, bounce, conversion flags
- `pageviews` - Individual page views with timestamps
- `events` - E-commerce events (view_product, add_to_cart, etc.)
- `conversions` - Purchase transactions with order details
- `utm_sessions` - UTM tracking history for multi-touch attribution
- `realtime_visitors` - Currently active visitors

## Development Commands

### Local Development (Docker Compose)

```bash
# Start all services (PostgreSQL, Backend, Frontend)
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop all services
docker-compose down

# Rebuild after code changes
docker-compose up -d --build
```

### Database Operations

```bash
# Connect to PostgreSQL
docker exec -it ma-postgres psql -U moadamda -d analytics

# Common queries
# View visitors count
SELECT COUNT(*) FROM visitors;

# View today's pageviews
SELECT COUNT(*) FROM pageviews WHERE timestamp >= CURRENT_DATE;

# View conversions
SELECT * FROM conversions ORDER BY timestamp DESC LIMIT 10;
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run development server (local testing without Docker)
npm run dev

# Build for production (REQUIRED after any frontend changes)
npm run build

# Preview production build
npm run preview
```

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Run development server (local testing without Docker)
npm run dev

# Run production server
npm start
```

## Git-Based Deployment Workflow

**IMPORTANT**: This project uses Git-based deployment. Always commit locally and push to GitHub, then pull on the server.

### For Backend Changes (`backend/src/**`)

```bash
# 1. Local: Commit and push
git add .
git commit -m "Description of changes"
git push origin main

# 2. Server: SSH and pull
ssh root@211.188.53.220
cd /root/moadamda-analytics
git pull origin main

# 3. Server: Rebuild Docker (--build is MANDATORY)
docker-compose -f docker-compose.prod.yml up -d --build

# 4. Server: Check logs
docker-compose -f docker-compose.prod.yml logs backend --tail 50
```

### For Frontend Changes (`frontend/src/**`)

```bash
# 1-3. Same as backend deployment

# 4. Server: Build frontend (CRITICAL STEP!)
cd /root/moadamda-analytics/frontend
npm run build

# 5. Server: Restart frontend container
cd /root/moadamda-analytics
docker-compose -f docker-compose.prod.yml restart frontend

# 6. Server: Check logs
docker-compose -f docker-compose.prod.yml logs frontend --tail 20

# 7. Browser: Hard refresh (Ctrl+Shift+R)
# Frontend serves static files from dist/ - browser cache must be cleared
```

**Never modify files directly on the server** - always use Git workflow.

## Critical Development Rules

### 1. Data Validation (Mandatory)

**Always validate data with production database before deploying**. See `.cursor/rules/data-validation.mdc` for details.

- Never trust query results without verification
- Test all SQL queries with actual production data
- Apply domain-specific sanity checks:
  - Time spent: 0-600 seconds (10 min max)
  - Session duration: 1-30 minutes
  - Purchase amount: 10,000-500,000 KRW

**Pause development and request user verification when**:
- Writing new SQL queries
- Seeing unexpected values (e.g., 22 days time spent)
- Working with unfamiliar tables

### 2. Design Guidelines

**No emojis allowed** - Use Ant Design icons instead:
```jsx
// Good
<Button icon={<ReloadOutlined />}>Refresh</Button>

// Bad
<Button>🔄 Refresh</Button>
```

Color palette:
- Primary: `#1890ff` (blue)
- Success: `#52c41a` (green)
- Warning: `#fa8c16` (orange)
- Error: `#f5222d` (red)
- Amount > 0: Bold with blue/green
- Amount = 0: Gray (#999)

### 3. Project Status Tracking

**Always read PROJECT_STATUS.md at the start of each session** to understand current phase and progress.

Current phase context:
- Phase 1-3: Core tracking, e-commerce events, dashboard UI (Completed)
- Phase 4: Marketing analysis with UTM tracking (Phase 4.1-4.3 Completed)
- Phase 5+: Advanced analytics (Planned)

## Key Technical Patterns

### Backend API Response Format

```javascript
// Standard success response
res.json({ data: [...], summary: {...} });

// Error response
res.status(500).json({ error: 'Error message' });
```

### Frontend Data Fetching

```javascript
// Use axios with localhost:3003 in dev, /api in production
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:3003'
  : '';

const response = await axios.get(`${API_BASE}/api/stats/today`);
```

### SQL Query Best Practices

```sql
-- Use WITH clauses for step-by-step validation
WITH step1 AS (
  SELECT ... -- First transformation
),
step2 AS (
  SELECT ... FROM step1 -- Second transformation
)
SELECT * FROM step2;

-- Always add sanity filters
WHERE time_spent_seconds > 0
  AND time_spent_seconds <= 600  -- 10 min limit
```

## Common Issues and Solutions

### Frontend changes not reflecting

**Cause**: Frontend serves pre-built static files from `dist/`

**Solution**:
1. Rebuild: `npm run build` in frontend directory
2. Restart container: `docker-compose restart frontend`
3. Hard refresh browser: Ctrl+Shift+R

### Docker not picking up code changes

**Cause**: Code is baked into Docker image

**Solution**: Always use `--build` flag:
```bash
docker-compose up -d --build
```

### UTM attribution confusion

The system tracks both First-Touch (visitors.utm_*) and Multi-Touch (utm_sessions table) attribution:
- **First-Touch**: Initial UTM when visitor first arrives
- **Last-Touch**: Most recent UTM session before purchase
- **Multi-Touch**: Complete history in utm_sessions table

Always specify which attribution model you're using.

## Project Documentation

- `README.md` - Quick start guide and phase roadmap
- `PROJECT_STATUS.md` - Current development status and checklist
- `PHASE4_PLAN.md` - Marketing analysis (UTM) feature specification
- `.cursor/rules/` - Development rules and guidelines:
  - `project-tracker.mdc` - Status tracking workflow
  - `design-guidelines.mdc` - UI/UX standards
  - `git-deployment.mdc` - Deployment procedures
  - `data-validation.mdc` - Data quality rules

## GitHub Repository

- URL: https://github.com/hongkimwork/moadamda-analytics
- Branch: main
- Access: Private repository

---

**Key Principle**: "Trust Nothing, Verify Everything" - Always validate with production data before deployment.
