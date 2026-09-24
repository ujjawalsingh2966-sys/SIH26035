# CONFIGURATION GUIDE

## Philosophy
Secrets never leak into the repository. 
Configurations must differentiate clearly across environments (`development`, `test`, `production`).

## Backend Config Strategy
Managed strictly via `dotenv` bound firmly in `backend/src/config/env.ts`. 
Typing variables upon boot guarantees the application crashes contextually if missing env var prerequisites.

## Frontend Config Strategy
Client-side variables require `NEXT_PUBLIC_` prefixes. Do not bundle database identifiers, backend secrets, or cryptographic payloads into the public Next JS build step.
