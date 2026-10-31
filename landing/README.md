# W8LAB landing application

This is an isolated public-facing landing site for the W8LAB laboratory prototype.

## Development

Run commands from this folder (not the monorepo root):

```sh
npm install
npm run dev
```

Open http://localhost:4173. Run `npm run build` to build the standalone site.

For local links to the existing Next.js application, create a `.env.local` file and configure:

```dotenv
VITE_APP_URL=http://localhost:3000
```

Copy other optional values from `.env.example`. Unconfigured Demo/Video/Repository links are explicitly labelled instead of pointed to invented URLs.

## Design

Built with React, TypeScript and Vite, guided by Leonxlnx/taste-skill (its landing-page rules). The main Next.js app uses the same metrology-inspired palette but independent CSS, package dependencies and routing. This folder intentionally does not modify the root npm workspaces or production Vercel configuration.

Product preview panels are **illustrative** and contain no real measurements, pass/fail outcomes or customer data.

## Deployment

Deploy this directory as its own Vite/static project with `npm run build` and output `dist/`. Set `VITE_APP_URL` to your actual Next.js application URL. Do not redirect the current W8LAB app root or change its deployment aliases until the landing URL is reviewed.

**Regulatory note:** W8LAB is a pilot and any prototype certificate is not a statutory certificate.
