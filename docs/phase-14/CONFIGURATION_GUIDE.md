# Phase 14 - Configuration Guide

## Environment Variables

| Variable | Description | Default / Example | Required |
|---|---|---|---|
| `PORT` | Service listening port | `3000` | No |
| `NODE_ENV` | Environment stage | `production` / `pilot` | Yes |
| `JWT_SECRET` | HMAC secret for access token verification | *(Must be securely injected)* | Yes |
| `DATA_DIR` | Path to local JSON document store | `./data` | No |
| `LOG_LEVEL` | Minimum log level for winston logger | `info` | No |

*Note: Never commit real production secrets into source repositories.*
