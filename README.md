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

`ANDROID_DEEPLINK_INFO` maps each Android package name to that app's SHA-256 signing certificate fingerprints and URL schemes:

```json
{
  "com.karasu256.karasulab": {
    "fingerprints": [
      "6D:F2:A9:61:19:57:34:E9:1E:45:82:42:A0:C6:92:42:2F:64:48:0E:88:29:7E:13:62:3B:82:1E:0D:F9:9B:0B",
      "BA:8E:FD:E5:6E:4F:4E:C7:C8:AF:34:62:6A:16:E1:6C:13:2A:AA:F7:B9:E4:03:C7:18:9D:C7:E7:9A:8F:94:39"
    ],
    "protocols": ["karasulab://"]
  }
}
```

`/asset-links` converts this into the standard Digital Asset Links statement format. When the variable is unset or malformed, `/asset-links` responds 503 with the reason instead of statements that trust no app.
