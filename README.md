# POI Mapping Platform MVP

A research team platform for mapping Points of Interest (POI) using Google Places API.

## Tech Stack

- **Frontend**: Next.js (App Router) + React + Tailwind CSS
- **Backend**: Node.js API routes (Next.js)
- **Database**: PostgreSQL
- **Worker**: Python
- **API**: Google Places API

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL
- Python 3.8+

### Installation

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env.local` and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

4. Run migrations:

   ```bash
   npm run migrate
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

Visit `http://localhost:3000`

## Project Structure

- `app/` - Next.js App Router (pages, layouts, API routes)
- `components/` - React components organized by feature
- `lib/` - Utilities, database, types, API integrations
- `workers/` - Python worker for async POI processing
- `public/` - Static assets

## Database

Key tables:

- `areas` - Geographic areas
- `grids` - Grid subdivisions
- `keyword_sets` - Search keywords
- `jobs` - POI search jobs
- `job_grids` - Job-Grid relationships
- `poi_raw` - Raw POI data
- `poi_master` - Deduplicated POI data
- `poi_job_map` - POI-Job relationships
- `exports` - Export records

## API Routes

- `GET/POST /api/areas`
- `GET/POST /api/grids`
- `GET/POST /api/keyword-sets`
- `GET/POST /api/jobs`
- `GET /api/jobs/[id]/status`
- `GET /api/poi/[jobId]`
- `POST /api/exports/[jobId]`

## Features

- Map & Grid Selection
- Create POI Search Jobs
- Monitor Job Status
- View POI Results
- Export Results to CSV
- (Optional) View Search History
