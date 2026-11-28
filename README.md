# api.karasu256.com

The public API worker for Karasu Lab, running on Cloudflare Workers. Split out of [Karasu-Lab/Karasu-Lab](https://github.com/Karasu-Lab/Karasu-Lab).

It is deployed as two separate workers: `api-karasu256-com` serves production (`api.karasu256.com`) from `main`, and `dev-api-karasu256-com` serves the preview environment on `dev-api.karasu256.com` (the `dev` environment in `wrangler.jsonc`, selected with `CLOUDFLARE_ENV=dev`) from every other branch. Per-branch Previews are not used.

## Required environment variables

Both jobs are thin wrappers around the shared [`deploy-worker`](https://github.com/Karasu-Lab/Workers) action (`Karasu-Lab/Workers/deploy-worker@v1`): the workflow only maps this app's names into the environment and passes its commands as parameters, and the action assembles the workspace, deploys, and prunes branch Previews to the newest five. The deploy workflow (`.github/workflows/deploy.yml`) reads the following GitHub Actions secrets and variables, organized by GitHub Environments. The production job runs in the `production` environment and the preview job in the `preview` environment (a `development` environment also exists); register each name at repository level as the default, and override it inside an environment only where that environment needs a different value — a name an environment does not define falls back to the repository-level entry. Values are never committed to the repository.

### Deployment

| Name | Kind | Used for |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | Secret | Authenticating wrangler against Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Variable | The Cloudflare account the worker is deployed to |

### Worker secrets

These are synced to the worker on every deploy; previews resolve the same names from the `preview` environment.

| Name | Used for |
| --- | --- |
| `DATABASE_URL` | Connection string of the database the API serves |
| `INTERNAL_API_SECRET` | Shared secret for internal API calls |
| `VERCEL_PROTECTION_BYPASS_SECRET` | Bypass secret for calling Vercel-protected deployments |

If one of these secrets is unset, the sync falls back to the default in the worker's `wrangler.jsonc` local environment, and skips the entry when it is defined in neither place.

### Worker variables

| Name | Used for |
| --- | --- |
| `ANDROID_DEEPLINK_INFO` | The Android asset link configuration that `/asset-links` serves, in the JSON format below |

`ANDROID_DEEPLINK_INFO` holds the statements in the standard Digital Asset Links format:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.karasu256.karasulab",
      "sha256_cert_fingerprints": [
        "F5:2E:C5:70:A6:62:30:DE:30:19:B0:32:91:47:BA:12:82:4B:E9:43:CE:A6:3B:FC:DE:2C:85:FE:AD:53:60:4C"
      ]
    }
  }
]
```

`/asset-links` serves this JSON as-is. When the variable is unset or malformed, `/asset-links` responds 503 with the reason instead of statements that trust no app.
