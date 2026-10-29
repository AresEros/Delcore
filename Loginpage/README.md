# Ares Auth — React + Node.js Authentication Starter

A polished, animated login and registration application with a persistent SQLite user database.

## Requirements
- Node.js 20.19+ or 22.12+
- npm

## Run locally

Open two terminals.

### 1. Backend
```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and replace `JWT_SECRET` with a long random secret.
```bash
# Windows PowerShell
Copy-Item .env.example .env
```
Then start the API:
```bash
npm run dev
```
API: http://localhost:4000  
Health check: http://localhost:4000/api/health

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open the URL printed by Vite (normally http://localhost:5173).

## Features
- Login and registration forms with client and server validation
- Password hashing using bcrypt
- SQLite database persists account records in `backend/data/ares.sqlite`
- Signed JWT in an HTTP-only cookie; no token stored in localStorage
- Logout and authenticated `/api/auth/me` endpoint
- Rate limiting, Helmet security headers, strict CORS, and generic login errors
- Responsive animated interface with reduced-motion support

## Security notes
- Never commit `.env` or production secrets.
- This starter is intended for local development and as a foundation. Before production, use HTTPS, set `COOKIE_SECURE=true`, use a managed database and secret store, add email verification/password reset, and review session revocation and deployment-specific CORS settings.
- JWT cookie authentication uses `SameSite=Lax`; deploy frontend and backend under an appropriate same-site domain configuration.
- Passwords are hashed and never stored as plain text. The application does not log passwords.
