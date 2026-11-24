import { z } from 'zod';
import { BadGatewayError, ForbiddenError, NotFoundError, ServiceUnavailableError } from './errors';

const domainsSchema = z.object({ result: z.array(z.object({ service: z.string() })) });
const workerSchema = z.object({ result: z.object({ id: z.string() }) });
const previewsSchema = z.object({
  result: z.array(z.object({ name: z.string(), urls: z.array(z.string()), deployed_on: z.string().nullable().optional() })),
});
const triggersSchema = z.object({
  result: z.array(
    z.object({ repo_connection: z.object({ provider_account_name: z.string(), repo_name: z.string() }).nullable().optional() })
  ),
});
const branchesSchema = z.array(z.object({ name: z.string() }));
const cloudflareErrorSchema = z.object({ errors: z.array(z.object({ message: z.string() })) });
const githubErrorSchema = z.object({ message: z.string() });

type CloudflareGet = <T>(path: string, schema: z.ZodType<T>) => Promise<T>;

export interface Preview {
  urls: string[];
  deployedAt?: string;
}

async function listBranches(token: string, repository: string): Promise<string[]> {
  const branches: string[] = [];
  for (let page = 1; ; page++) {
    const res = await fetch(`https://api.github.com/repos/${repository}/branches?per_page=100&page=${page}`, {
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

async function listLinkedBranches(token: string | undefined, get: CloudflareGet, service: string): Promise<string[] | null> {
  if (!token) return null;
  const worker = await get(`/workers/workers/${service}`, workerSchema).catch(() => null);
  if (!worker) return null;
  const triggers = await get(`/builds/workers/${worker.result.id}/triggers`, triggersSchema).catch(() => null);
  const repository = triggers?.result.find((trigger) => trigger.repo_connection)?.repo_connection;
  if (!repository) return null;
  return listBranches(token, `${repository.provider_account_name}/${repository.repo_name}`).catch(() => null);
}

export async function listPreviews(env: Env, domain: string): Promise<Record<string, Preview>> {
  const { CF_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId } = env;
  const missing = Object.entries({ CF_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId })
    .filter(([, value]) => !value)
    .map(([name]) => name);
  if (missing.length) throw new ServiceUnavailableError(undefined, `${missing.join(', ')} not configured`);

  const get: CloudflareGet = async (path, schema) => {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = cloudflareErrorSchema.safeParse(await res.json().catch(() => null));
      const reason = `Cloudflare responded ${res.status}${body.success ? `: ${body.data.errors.map((error) => error.message).join(', ')}` : ''}`;
      throw res.status === 401 || res.status === 403 ? new ForbiddenError(undefined, reason) : new BadGatewayError(undefined, reason);
    }
    const parsed = schema.safeParse(await res.json());
    if (!parsed.success) throw new BadGatewayError(undefined, 'Cloudflare returned a response in an unexpected shape');
    return parsed.data;
  };

  const domains = await get(`/workers/domains?hostname=${encodeURIComponent(domain)}`, domainsSchema);
  const service = domains.result[0]?.service;
  if (!service) throw new NotFoundError(undefined, `No worker is served on ${domain}`);

  const previews = await get(`/workers/workers/${service}/previews?per_page=100`, previewsSchema);
  const previewByName = new Map(previews.result.map((preview) => [preview.name, preview]));
  const branches = (await listLinkedBranches(env.GH_TOKEN, get, service)) ?? [...previewByName.keys()];
  return Object.fromEntries(
    branches.map((branch) => {
      const preview = previewByName.get(branch);
      return [branch, { urls: preview?.urls ?? [], ...(preview?.deployed_on ? { deployedAt: preview.deployed_on } : {}) }];
    })
  );
}
