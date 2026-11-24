import { Elysia, status } from 'elysia';
import { z } from 'zod';
import { parsePermissionId, permissionIdWithinOperation } from '@karasu-lab/api-permissions';
import { verifyApiKey } from '../../../lib/auth';

const verifyBodySchema = z.object({ key: z.string().min(1) });

interface OperationPermissions {
  operation: string;
  permissions: string[];
}

function groupByOperation(permissionIds: readonly string[]): OperationPermissions[] {
  const operations = new Map<string, string[]>();
  for (const publicId of permissionIds) {
    const definition = parsePermissionId(publicId);
    if (!definition) continue;
    operations.set(definition.operation, [...(operations.get(definition.operation) ?? []), permissionIdWithinOperation(definition)]);
  }
  return [...operations.entries()].map(([operation, permissions]) => ({ operation, permissions }));
}

export const apiKeysVerifyPost = (env: Env) =>
  new Elysia().post('/api-keys/verify', async ({ body }) => {
    const parsed = verifyBodySchema.safeParse(body);
    if (!parsed.success) throw parsed.error;
    const verified = await verifyApiKey(parsed.data.key, env);
    if (!verified) throw status(401, 'Unauthorized');
    return { userId: verified.userId, keyId: verified.keyId, operations: groupByOperation(verified.permissionIds) };
  });
