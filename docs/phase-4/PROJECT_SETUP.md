# PROJECT SETUP GUIDE

## Prerequisites
- Node.js (v20+)
- npm (v10+)

## Initial Setup
The project utilizes NPM Workspaces to manage the Monorepo dependencies.
1. Run `npm install` from the root directory. This will resolve and link all `frontend` and `backend` modules simultaneously.
2. Duplicate `backend/.env.example` to `backend/.env` and update secrets (if applicable in future phases).

## Running the Application
From the root directory:
- **Run all:** `npm run dev`
- **Run frontend only:** `npm run dev -w @nawi/frontend`
- **Run backend only:** `npm run dev -w @nawi/backend`

## Structure
- `./backend/`: Node/Express calculation pipeline server.
- `./frontend/`: Next.js React shell client.
- `./docs/`: Master architectural and statutory specifications.
