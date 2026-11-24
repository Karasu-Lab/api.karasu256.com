import { z } from 'zod';
import { BadGatewayError, ForbiddenError, ServiceUnavailableError } from './errors';

const previewsSchema = z.object({
  result: z.array(z.object({ name: z.string(), slug: z.string(), deployed_on: z.string().nullable().optional() })),
});
const branchesSchema = z.array(z.object({ name: z.string() }));
const cloudflareErrorSchema = z.object({ errors: z.array(z.object({ message: z.string() })) });
const githubErrorSchema = z.object({ message: z.string() });

export interface Preview {
  url: string;
  deployedAt?: string;
}

export function branchSlug(branch: string): string {
  return branch.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

async function listBranches(token: string): Promise<string[]> {
  const branches: string[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/Karasu-Lab/api-auth.karasu256.com/branches?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'api.karasu256.com' },
    });
    if (!res.ok) {
      const body = githubErrorSchema.safeParse(await res.json().catch(() => null));
      throw new BadGatewayError(undefined, `GitHub responded ${res.status}${body.success ? `: ${body.data.message}` : ''}`);
    }
    const parsed = branchesSchema.safeParse(await res.json());
    if (!parsed.success) throw new BadGatewayError(undefined, 'GitHub returned a branch list in an unexpected shape');
    branches.push(...parsed.data.map((branch) => branch.name));
    if (parsed.data.length < 100) return branches;
  }
}

export async function listPreviews(env: Env, workerId: string | undefined = env.API_AUTH_WORKER_ID): Promise<Record<string, Preview>> {
  const { CF_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId } = env;
  const missing = Object.entries({ CF_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId, API_AUTH_WORKER_ID: workerId })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) throw new ServiceUnavailableError(undefined, `${missing.join(', ')} not configured`);

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${workerId}/previews?per_page=100`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = cloudflareErrorSchema.safeParse(await res.json().catch(() => null));
    const reason = `Cloudflare responded ${res.status}${body.success ? `: ${body.data.errors.map((error) => error.message).join(', ')}` : ''}`;
    throw res.status === 401 || res.status === 403 ? new ForbiddenError(undefined, reason) : new BadGatewayError(undefined, reason);
  }
  const parsed = previewsSchema.safeParse(await res.json());
  if (!parsed.success) throw new BadGatewayError(undefined, 'Cloudflare returned a preview list in an unexpected shape');

  const deployedByName = new Map(parsed.data.result.map((preview) => [preview.name, preview]));
  const branches = env.GH_TOKEN ? await listBranches(env.GH_TOKEN) : [...deployedByName.keys()];
  return Object.fromEntries(
    branches.map((branch) => {
      const deployedAt = deployedByName.get(branch)?.deployed_on;
      return [
        branch,
        { url: `https://${deployedByName.get(branch)?.slug ?? branchSlug(branch)}.dev-api-auth.karasu256.com`, ...(deployedAt ? { deployedAt } : {}) },
      ];
    })
  );
}
