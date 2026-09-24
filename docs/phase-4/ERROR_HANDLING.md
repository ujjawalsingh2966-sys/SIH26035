# ERROR HANDLING

## Backend Contract
Any backend crash processes via `src/middlewares/errorHandler.ts` returning exactly:
```json
{
  "success": false,
  "error": "Message" 
}
```
Stack traces are suppressed natively if `NODE_ENV` equates to production.

## Error Codes
Later phases should expand the `error` string into a structured standard JSON layout matching explicit strings enumerated in `docs/phase-2/DOMAIN_ERROR_CATALOG.md`.
