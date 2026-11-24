import { Elysia, status } from 'elysia';
import { withDataSource } from '../../../db/data-source';
import { User } from '../../../db/entities/user';
import { deriveAuth, requirePermission } from '../../../lib/guards';

export const userProfileGet = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).get(
    '/user/profile',
    async ({ auth }) => {
      const user = await withDataSource(env, (dataSource) => dataSource.getRepository(User).findOneBy({ id: auth!.userId }));
      if (!user) throw status(404, 'not_found');
      return { id: user.id, name: user.name, image: user.image };
    },
    { beforeHandle: requirePermission('users:profile.read') }
  );
