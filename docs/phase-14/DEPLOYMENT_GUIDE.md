# Phase 14 - Deployment Guide

## Prerequisites
- Node.js >= 18.0.0 LTS
- npm >= 9.0.0
- Linux / Windows Server / macOS deployment target

## Step-by-Step Installation
1. **Clone Release Tag**:
   ```bash
   git clone https://github.com/organization/nawi-compliance.git
   cd nawi-compliance/backend
   ```
2. **Install Production Dependencies**:
   ```bash
   npm ci --omit=dev
   ```
3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and configure environment-specific secrets.
4. **Compile TypeScript**:
   ```bash
   npm run build
   ```
5. **Start Service**:
   ```bash
   npm start
   ```
6. **Verify Health**:
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
