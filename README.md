# Long2Text

Long screenshot to formatted text. Specialized OCR for chat records, meeting transcripts, and articles.

## Architecture

```
long2text/
├── web/     # Next.js frontend (Vercel)
├── api/     # FastAPI + PaddleOCR backend (Railway/Docker)
```

## Quick Start

### Frontend (Next.js)

```bash
cd web
npm install
npm run dev     # http://localhost:3000
```

### Backend (FastAPI + PaddleOCR)

```bash
cd api
pip install -r requirements.txt
uvicorn main:app --reload   # http://localhost:8000
```

### Docker (Backend)

```bash
cd api
docker build -t long2text-api .
docker run -p 8000:8000 long2text-api
```

## Deploy

### Frontend → Vercel

```bash
cd web
npx vercel --prod
```

### Backend → Railway / Fly.io / Self-hosted

The Python backend requires PaddleOCR which needs ~2GB RAM.

Option 1: Railway
```bash
cd api
railway up
```

Option 2: Docker on your Mac Mini
```bash
cd api
docker compose up -d
```

## Environment Variables

See `web/.env.example` for all configuration options.

## Features

- Smart splitting of ultra-long screenshots with overlap
- PaddleOCR for high-accuracy Chinese + English recognition
- Scene-specific formatting (chat, meeting, article)
- Markdown output preserving structure
- Bilingual UI (Chinese/English)
- Free tier + paid full results
