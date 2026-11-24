import { Elysia } from 'elysia';
import { z } from 'zod';
import { withDataSource } from '../../../db/data-source';
import { User } from '../../../db/entities/user';
import { deriveAuth, requirePermission } from '../../../lib/guards';
import { NotFoundError } from '../../../lib/errors';

const updateProfileBodySchema = z.object({ name: z.string().nullable() });

export const userProfilePatch = (env: Env) =>
  new Elysia().derive(deriveAuth(env)).patch(
    '/user/profile',
    async ({ auth, body }) => {
      const parsed = updateProfileBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      const user = await withDataSource(env, async (dataSource) => {
        const repository = dataSource.getRepository(User);
        const result = await repository.update({ id: auth!.userId }, { name: parsed.data.name, updatedAt: new Date() });
        if (!result.affected) return null;
        return repository.findOneBy({ id: auth!.userId });
      });
      if (!user) throw new NotFoundError();
      return { id: user.id, name: user.name, image: user.image };
    },
    { beforeHandle: requirePermission('users:profile.write') }
  );
