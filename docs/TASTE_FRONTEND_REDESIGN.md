# W8LAB — Taste Skill frontend redesign

## Integration review — 31 October 2026

The user approved the redesign's visual direction and requested review followed by integration into `main`.

Review corrections:
- Explicitly use the paper workspace's light theme. Legacy OS-driven Tailwind dark variants otherwise render white text on the redesigned light cards, including instrument names and dashboard metrics. Dark variants now require an explicit class, and the document declares its light theme.
- Allow the workspace breadcrumb to shrink and truncate long page names while keeping the mobile navigation and sign-out controls available.

Verified locally after these corrections:
- Next.js production build, TypeScript and build lint passed.
- Backend TypeScript build and all 96 tests across 12 suites passed.
- Standalone landing TypeScript and Vite production build passed.
- Sixteen targeted React component checks passed with mocked APIs: all six role redirects, Business registration feedback, sign-in error and duplicate-submit handling, staff navigation permissions, mobile navigation, exact-decimal instrument validation and intake responses, plus landing carousel, tabs, FAQ and unavailable links.
- Production HTTP checks returned successful responses for the login, seven CSS/JavaScript assets and eight operational/public routes. The existing root-to-login redirect source is unchanged.
- Disposable local accounts verified all six real sign-in/account API contracts, staff access restrictions, and manufacturer registration → instrument registration → test-case retrieval through the unchanged backend.
- `git diff --check` passed. No backend source, authentication contract, computation or persistence changes are included.

Remaining verification limits:
- Live browser screenshots, viewport-specific visual/keyboard checks and print preview were not completed. Vercel preview authentication blocked the cloud browser; automatic approval review rejected the protected-fetch operation because it creates a temporary share link. The remote browser could not reach the local server. No deployment protection or sharing settings were changed.
- The React component checks exercise component behavior rather than a real browser. They do not establish deployed end-to-end or visual acceptance.
- The landing remains a separate application. Merging the frontend does not publish or configure a separate landing deployment or its optional CTA destinations.

The implementation notes and original release checklist below retain the follow-up browser and deployment checks.

## Design source
- Skill: https://github.com/Leonxlnx/taste-skill
- Skill spec: \`skills/taste-skill/SKILL.md\`; app screen reference: \`skills/taste-skill/references/app-screens.md\`
- Visual direction: evidence-led metrology, precision of instruments and observation sheets, pale paper/graphite application workbench, deep green landing editorial.
- Landing pages and app screens deliberately use different motion and density rules: visual storytelling on the landing; disciplined navigation and legible tables on working screens.

## Architecture and boundaries
- \`frontend/\`: existing Next.js 14 application and role-aware API integrations.
- \`landing/\`: newly isolated Vite/React/TypeScript public landing site. Its own dependencies and CSS; not added to root workspaces.
- \`backend/\`: **unchanged** by the redesign.
- Existing \`frontend/app/page.tsx\` still redirects to \`/login\`; no production redirect or deployment aliases changed.
- Production URLs for landing CTAs come from \`VITE_APP_URL\` and optional \`VITE_DEMO_URL\`, \`VITE_REPOSITORY_URL\`, \`VITE_VIDEO_URL\`.

## Screen inventory
| Area | Route | Treatment |
| --- | --- | --- |
| Login / Business sign-up | \`/login\` | Editorial two-column identity and accessible sign-in form |
| Laboratory / Administrator overview | \`/dashboard\` | Clear status metrics with low-chrome icon treatment |
| Business / officer applications | \`/applications\` | Scoped card, table, form and responsive styles |
| Application inspection / cert issuance | \`/applications/[id]\` | Scoped detailed workflow and table styles |
| Instrument registry | \`/instruments\` | Accessible errors, working retry, honest pilot actions |
| Instrument intake | \`/instruments/new\` | Stepper, manufacturer selection, exact-string decimal validation |
| Test case queue | \`/tests\` | Scoped queue, filter and data presentation |
| Observation workspace | \`/test-cases/[id]/workspace\` | Scoped laboratory workspace, table, control and state styling |
| Staff administration | \`/staff\` | New form / directory layout and feedback |
| Public prototype lookup | \`/verify/[token]\` | Public privacy-first record presentation |
| Standalone landing | \`landing/\` | Product motif, editorial sections, interactive carousel/FAQ/workflow |

## Risk and regression guidance
- Do not describe the pilot as officially certified. Existing certificate disclaimers remain mandatory.
- Avoid changing observation values, reporting formulas, compliance decisions, role authorization or API shape during visual polish.
- The instrument intake form now uses actual manufacturers from the existing endpoint; previously it used \`mfr_placeholder\`. It also detects failure when test-case creation fails after instrument creation. This requires end-to-end testing with valid Technician credentials and a disposable dataset.
- The registry hides unavailable import/edit/delete/export affordances rather than presenting buttons that cannot complete their actions.
- Build checks on the PR include standalone landing typechecking/build, existing Next.js build, and backend regression suite. These do **not** replace role-by-role browser testing.
- Taste Skill's screenshot inspector and source lint were not run against the locally hosted project by this GitHub-only implementation. Complete the manual screenshot round at 1440, 768 and 390 pixels before release.

## Local commands
From the monorepo root (Node.js 22 recommended):

\`\`\`sh
npm ci
npm run build --workspace frontend
npm test --workspace backend -- --runInBand --coverage=false
\`\`\`

For the independent landing:

\`\`\`sh
cd landing
npm install
npm run build
npm run dev
\`\`\`

Use a separate terminal to launch the Next.js application normally. If the landing is deployed separately, configure \`VITE_APP_URL\` for the real app before building.

## Acceptance checklist
- [ ] Next.js production build passes for the final reviewed SHA.
- [ ] Backend regression suite passes.
- [ ] Landing TypeScript + Vite build passes.
- [ ] Screenshot and Taste Skill inspector pass on landing at 1440/768/390.
- [ ] Browser interaction QA passes on login/Business registration.
- [ ] Business application creation, scheduling, inspection, review, certificate flows verified.
- [ ] Technician instrument intake + test-case creation verified with real manufacturer.
- [ ] Observation precision, report generation and printing verified unchanged.
- [ ] Staff RBAC verified; public lookup exposes no private data.
- [ ] Keyboard navigation, reduced motion, contrast and mobile overflow checked.
- [ ] Landing CTA URLs configured for target deployment.
- [ ] Reviewed PR approved before merge and production promotion.
