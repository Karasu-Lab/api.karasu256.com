import { Elysia } from 'elysia';
import { withDataSource } from '../../../../../../db/data-source';
import { Account } from '../../../../../../db/entities/account';
import { parseRawJson, requireInternalUser } from '../../../../../../lib/guards';
import { NotFoundError } from '../../../../../../lib/errors';

export const internalUserLinkedProviderDelete = (env: Env) =>
  new Elysia()
    .onParse(parseRawJson)
    .onBeforeHandle(requireInternalUser(env))
    .delete('/internal/users/:userId/linked-providers/:providerId', async ({ params, set }) => {
      const result = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(Account).delete({ userId: params.userId, providerId: params.providerId })
      );
      if (!result.affected) throw new NotFoundError('Not found');
      set.status = 204;
      return null;
    });
