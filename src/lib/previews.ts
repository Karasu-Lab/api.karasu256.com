import { status } from 'elysia';
import { z } from 'zod';

const accountsSchema = z.object({ result: z.array(z.object({ id: z.string() })) });
const workerSchema = z.object({ result: z.object({ id: z.string(), name: z.string() }) });
const versionsSchema = z.object({
  result: z.object({
    items: z.array(z.object({ urls: z.array(z.string()).optional(), metadata: z.object({ created_on: z.string() }).optional() })),
  }),
});
const branchesSchema = z.array(z.object({ name: z.string() }));

export interface Preview {
  url: string;
  deployedAt?: string;
}

export function branchSlug(branch: string): string {
  return branch.toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

async function cloudflare<T>(token: string, path: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw status(res.status === 401 || res.status === 403 ? 403 : 502, 'cloudflare_unavailable');
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw status(502, 'cloudflare_unexpected_response');
  return parsed.data;
}

async function listBranches(token: string): Promise<string[]> {
  const branches: string[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/Karasu-Lab/api-auth.karasu256.com/branches?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'api.karasu256.com' },
    });
    if (!res.ok) throw status(502, 'github_unavailable');
    const parsed = branchesSchema.safeParse(await res.json());
    if (!parsed.success) throw status(502, 'github_unexpected_response');
    branches.push(...parsed.data.map((branch) => branch.name));
    if (parsed.data.length < 100) return branches;
  }
}

function previewSlug(url: string): string {
  return new URL(url).hostname.split('.')[0]!;
}

export async function listPreviews(env: Env, workerId: string): Promise<Record<string, Preview>> {
  const token = env.CF_TOKEN;
  if (!token) throw status(503, 'cf_api_token_not_configured');

  const accounts = await cloudflare(token, '/accounts', accountsSchema);
  const accountId = accounts.result[0]?.id;
  if (!accountId) throw status(403, 'cloudflare_account_not_found');
  const worker = await cloudflare(token, `/accounts/${accountId}/workers/workers/${workerId}`, workerSchema);
  const versions = await cloudflare(token, `/accounts/${accountId}/workers/scripts/${worker.result.name}/versions`, versionsSchema);

  const deployedBySlug = new Map<string, string>();
  for (const version of versions.result.items) {
    const createdOn = version.metadata?.created_on;
    if (!createdOn) continue;
    for (const url of version.urls ?? []) {
      const slug = previewSlug(url);
      const current = deployedBySlug.get(slug);
      if (!current || current < createdOn) deployedBySlug.set(slug, createdOn);
    }
  }

  const branches = env.GH_TOKEN ? await listBranches(env.GH_TOKEN) : [...deployedBySlug.keys()];
  return Object.fromEntries(
    branches.map((branch) => {
      const slug = branchSlug(branch);
      const deployedAt = deployedBySlug.get(slug);
      return [branch, { url: `https://${slug}.dev-api-auth.karasu256.com`, ...(deployedAt ? { deployedAt } : {}) }];
    })
  );
}
