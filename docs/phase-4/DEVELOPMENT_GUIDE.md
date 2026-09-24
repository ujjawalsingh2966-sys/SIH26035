# DEVELOPMENT GUIDE

## Rules of Engagement
1. **No Domain Logic in Frontend:** All metrological formulas, rounding, and rules logic MUST sit in the backend calculation engine. The frontend is exclusively an observer layer.
2. **Infinite Precision:** Floating-point math is banned. Future engine calculations must invoke `decimal.js`.
3. **Immutability:** Backend states should rely heavily on pure stateless evaluation pipes.

## Code formatting
Run `npm run lint` globally. ESLint rules are strictly tied to standard configurations mapped out in Phase 4.

## Adding future modules
Keep Domain modules separate from infrastructural controllers.
When bringing Phase 2 online, create a `/backend/src/domain/metrology` boundary entirely disconnected from `/backend/src/routes`.
