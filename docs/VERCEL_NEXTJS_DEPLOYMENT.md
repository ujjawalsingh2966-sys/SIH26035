# W8LAB — Vercel deployment for the existing Next.js frontend

## Current repository layout

The **GitHub `main` branch** is an npm-workspaces monorepo:

- `package.json` and `package-lock.json` at repository root.
- `frontend/` is the actual **Next.js application** (`@nawi/frontend`, `next build`).
- `backend/` is the separate Express application; it is **not** a Vercel Next.js app.
- The separately developed landing page is not part of this `main` commit; do not change the root to `landing` for this deployment.

A failing production screenshot shows Vercel aborting during `npm install --prefix=.` with exit code 254. That final message alone does **not** reveal the first underlying npm error. The screenshot is associated with `main` commit `a72f79f` and Vercel project `sih26035`; other GitHub checks also mention another project `sih-26035`. Treat those as separate Vercel projects until verified.

## Verified repository-level build

[GitHub Actions smoke workflow](../.github/workflows/vercel-nextjs-smoke.yml) runs on a clean Linux Node 22 runner:

```bash
npm ci --no-audit --no-fund
npm run build --workspace frontend
```

This succeeds on the branch created directly from `main`. The same clean `npm ci` also passed when launched from within `frontend/`, demonstrating npm workspace-lockfile discovery from the app directory. These tests validate the repository, not the Vercel project configuration or its environment variables.

## Required project settings (Vercel dashboard)

Select the **intended** project at [Vercel Dashboard](https://vercel.com/dashboard), and open **Settings → Build and Deployment**:

| Field | Intended value |
|---|---|
| Framework Preset | **Next.js** |
| Root Directory | **`frontend`** (relative to Git repository) |
| Install Command | **`npm ci`** from `frontend/vercel.json` (verified by CI from the frontend directory). Clear conflicting dashboard overrides if any. Do not use `npm install --prefix=.`. |
| Build Command | **`npm run build`** from `frontend/vercel.json` (equivalent to frontend workspace Next.js build). |
| Output Directory | **Automatic** for Next.js, not `dist` or backend output |
| Node.js version | **22.x**, matching the workflow |

The branch additionally supplies **`frontend/vercel.json`** to pin the tested `framework`, `installCommand`, and `buildCommand`. Vercel will only read this file for the frontend deployment when the project points at **Root Directory = `frontend`**; a GitHub commit alone does not alter the Vercel project's root setting. The config reaches production only after this PR is merged into the production branch, and its effect requires a new deployment.

Then open **Settings → Environment Variables** and verify the **public, nonsecret** `NEXT_PUBLIC_API_BASE_URL` is set to the actual W8LAB backend API URL (for example the verified API deployment `https://w8lab-api.onrender.com`). This variable is public by design and is not a database password. Never put `DATABASE_URL`, PostgreSQL passwords, signing secrets or service-role secrets in public Next.js variables.

In **Settings → Git**, confirm the connected repository and production branch `main` match the intended source. If there are two linked Vercel projects for the same GitHub repository, verify which domain should be public and adjust only that intended project's settings; don't delete or disconnect the other project without approval.

## Redeploy and validation

1. Save dashboard changes. They affect **subsequent** deployments.
2. In **Deployments**, redeploy the correct latest-`main` deployment and choose **without build cache** for the first troubleshooting attempt, if the option is shown.
3. Open **Build Logs** from the *new* deployment. Confirm the checkout, detected framework/root, npm install line, and actual Next.js build output.
4. Visit the preview/production URL and test initial page load and the frontend's calls to the separately deployed backend.
5. If failure persists, capture the **first real npm `error` message and 20 lines before it**, not just the final `exited with 254` summary. Do not share secrets from logs.

Do not merge unrelated database-migration branches to fix this Vercel problem, and do not repoint production to the unreviewed development branch. This PR remains Draft until Vercel settings are confirmed. Once the intended Vercel project is configured, review and merge this fix PR, then redeploy the updated `main` commit. The migration remains in Draft PR #6; this deployment diagnostic branch is separate.
