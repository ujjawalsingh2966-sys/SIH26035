# TECHNOLOGY DECISIONS

## Overview
This document records the technology stack selections for the NAWI Compliance Automation platform, established during Phase 4: Application Foundation.

## 1. Project Structure
- **Decision:** NPM Workspaces (Monorepo)
- **Reason:** Keeps frontend and backend together in a single repository for easy full-stack development, shared generic typings, and unified linting rules. Highly AI-friendly as context is centralized.
- **Alternative:** Discrete repositories.
- **Trade-off:** Slower initial setup of shared CI boundaries; but much faster iteration for small teams or AI assistants.

## 2. Frontend Framework
- **Decision:** React with Next.js (App Router) + TypeScript + Tailwind CSS
- **Reason:** Standardized web application skeleton. Next.js supports SSG/SSR where needed for reports later. Tailwind CSS enforces the strict, semantic design system requirements outlined in Phase 3 without massive custom CSS files. TypeScript enforces strictly typed boundaries preventing data contamination.
- **Alternative:** Vue/Nuxt, vanilla React + Vite.
- **Trade-off:** Added complexity of App Router, but provides unmatched route-based loading, error boundaries, and nested layouts which perfectly map to our Information Architecture.

## 3. Backend Framework
- **Decision:** Node.js with Express + TypeScript
- **Reason:** Highly established, proven, and AI-friendly API foundation. Minimal abstraction layer makes establishing the strict Calculation/Rule Engine (which requires pure stateless functions per Phase 2) straightforward to integrate via controllers later.
- **Alternative:** NestJS, Python FastAPI, Next.js internal API routes.
- **Trade-off:** Requires more manual setup of dependency injection and error handling than a full framework like NestJS, but maintains the explicitly defined decoupled architecture without framework lock-in.

## 4. Arithmetic Engine (For Future Integration)
- **Decision:** `decimal.js`
- **Reason:** Phase 2 strongly mandates arbitrary precision decimal arithmetic and explicitly prohibits IEEE 754 floating-point math for metrological validity.
- **Alternative:** `BigInt` (no native decimal support), PostgreSQL `DECIMAL`.
- **Trade-off:** Slower than native floating-point math, but essential for compliance.

## 5. Testing Framework
- **Decision:** Jest (Backend) & Vitest + React Testing Library (Frontend)
- **Reason:** Fast, reliable, well-documented automated testing for unit and integration bounds to satisfy the 80% coverage mandate.
- **Alternative:** Mocha/Chai, pure Jest globally.
- **Trade-off:** Two slightly different test runners across the monorepo, however, Vitest is significantly faster for React components.

## 6. Authentication Foundation
- **Decision:** JSON Web Tokens (JWT) & Passport.js or standard middleware
- **Reason:** Disconnected/stateless authorization boundary making backend strictly API-driven and consumable. Fits role-based access perfectly (Technician vs Approver).
- **Alternative:** NextAuth (tied exclusively to Next.js), heavily stateful sessions (Redis).
- **Trade-off:** Token revocation requires specific handling, but scale and frontend decoupling are natively supported.
