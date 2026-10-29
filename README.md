# api.karasu256.com

The public API worker for Karasu Lab, running on Cloudflare Workers. Split out of [Karasu-Lab/karasu256.com](https://github.com/Karasu-Lab/karasu256.com).

## Required environment variables

The deploy workflow (`.github/workflows/api-deploy.yml`) reads the following GitHub Actions secrets and variables. Register them on this repository under exactly these names. Values are never committed to the repository.

### Deployment

| Name | Kind | Used for |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | Authenticating wrangler against Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | The Cloudflare account the worker is deployed to |

### Worker secrets

These are synced to the production worker on every deploy to `main`. Branch previews use the same values.

| Name | Used for |
| --- | --- |
| `DATABASE_URL` | Connection string of the database the API serves |
| `INTERNAL_API_SECRET` | Shared secret for internal API calls |
| `VERCEL_PROTECTION_BYPASS_SECRET` | Bypass secret for calling Vercel-protected deployments |

If one of these secrets is unset, the sync falls back to the default in the worker's `wrangler.jsonc` local environment, and skips the entry when it is defined in neither place.
