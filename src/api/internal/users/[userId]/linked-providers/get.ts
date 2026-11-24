import { Elysia } from 'elysia';
import { withDataSource } from '../../../../../db/data-source';
import { Account } from '../../../../../db/entities/account';
import { parseRawJson, requireInternalUser } from '../../../../../lib/guards';

export const internalUserLinkedProvidersGet = (env: Env) =>
  new Elysia()
    .onParse(parseRawJson)
    .onBeforeHandle(requireInternalUser(env))
    .get('/internal/users/:userId/linked-providers', async ({ params }) => {
      const rows = await withDataSource(env, (dataSource) =>
        dataSource.getRepository(Account).find({ where: { userId: params.userId }, select: { providerId: true } })
      );
      return { providerIds: rows.map((row) => row.providerId) };
    });
