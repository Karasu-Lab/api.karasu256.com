import { Elysia } from 'elysia';
import { withPermissionService } from '../../../lib/permission-service';
import { NotFoundError } from '../../../lib/errors';

export const operationPermissionsGet = (env: Env) =>
  new Elysia().get('/:operation/permissions', async ({ params }) => {
    const permissions = await withPermissionService(env, (service) => service.listOperationPermissions(params.operation));
    if (permissions.length === 0) throw new NotFoundError('unknown_operation');
    return { operation: params.operation, permissions: permissions.map((permission) => permission.publicId) };
  });
