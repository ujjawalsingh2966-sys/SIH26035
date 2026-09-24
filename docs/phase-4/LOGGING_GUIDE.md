# LOGGING GUIDE

## Standards
`console.log()` is explicitly prohibited in production pipelines.
Winston logging is instantiated in `src/utils/logger.ts`.

All major state changes (Login failure, Route Access Denials) should dispatch `logger.info()` or `logger.warn()` securely without exposing HTTP Request body plain-text passwords or tokens.
