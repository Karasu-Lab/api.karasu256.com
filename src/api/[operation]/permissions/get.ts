import { Elysia, status } from 'elysia';
import { withPermissionService } from '../../../lib/permission-service';

export const operationPermissionsGet = (env: Env) =>
  new Elysia().get('/:operation/permissions', async ({ params }) => {
    const permissions = await withPermissionService(env, (service) => service.listOperationPermissions(params.operation));
    if (permissions.length === 0) throw status(404, 'unknown_operation');
    return { operation: params.operation, permissions: permissions.map((permission) => permission.publicId) };
  });
