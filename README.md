# CSSA Backend

Backend API for CSSA website with Notion integration.

## Endpoints

- `POST /api/submit-lead` - Submit lead application
- `POST /api/submit-contact` - Submit contact form
- `GET /api/health` - Health check

## Environment Variables

- `NOTION_TOKEN` - Notion integration token
- `NOTION_LEADS_DB_ID` - Notion database ID for leads

## Deployment

This backend is designed to be deployed on Vercel as serverless functions.