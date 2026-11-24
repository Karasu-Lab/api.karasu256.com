import { Elysia, NotFoundError } from 'elysia';
import { z } from 'zod';
import { withDataSource } from '../../../../../db/data-source';
import { User } from '../../../../../db/entities/user';
import { parseRawJson, requireInternalUser } from '../../../../../lib/guards';

const imageBodySchema = z.object({ image: z.string().max(2048).nullable() });

export const internalUserImagePost = (env: Env) =>
  new Elysia()
    .onParse(parseRawJson)
    .onBeforeHandle(requireInternalUser(env))
    .post('/internal/users/:userId/image', async ({ params, body }) => {
      const parsed = imageBodySchema.safeParse(body);
      if (!parsed.success) throw parsed.error;
      const result = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(User).update({ id: params.userId }, { image: parsed.data.image, updatedAt: new Date() })
      );
      if (!result.affected) throw new NotFoundError();
      return { image: parsed.data.image };
    });
