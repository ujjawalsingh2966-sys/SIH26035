# Risk Register

| Risk ID | Vulnerability | Severity | Mitigation Plan | Status |
|---|---|---|---|---|
| R-001 | Express-Validator un-enforced rules | CRITICAL | Implement `validateRequest` middleware across all routes. | Open |
| R-002 | IDOR on Test Cases and Observations | HIGH | Inject object-ownership checks in `PUT`/`POST` handlers. | Open |
| R-003 | Hardcoded Auth Password | MEDIUM | Lock or remove hardcoded auth password if needed, or isolate it. | Open |
| R-004 | XSS Vulnerability in HTML Generation | HIGH | Escape user strings in `HtmlGenerator.ts` before placing in template. | Open |
| R-005 | Missing Global Rate Limiting | LOW | Add `express-rate-limit` for basic DoS protection. | Open |
