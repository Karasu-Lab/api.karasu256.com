import 'reflect-metadata';
import pg from 'pg';
import { DataSource } from 'typeorm';
import { ApiKeyPermission } from './entities/api-key-permission';
import { Permission } from './entities/permission';
import { User } from './entities/user';

/** Workers cannot reuse connections across requests, and Hyperdrive already pools them. */
export async function withDataSource<T>(env: Env, work: (dataSource: DataSource) => Promise<T>): Promise<T> {
  const dataSource = new DataSource({
    type: 'postgres',
    driver: pg,
    url: env.HYPERDRIVE.connectionString,
    entities: [User, Permission, ApiKeyPermission],
    synchronize: false,
    extra: { max: 1 },
  });
  await dataSource.initialize();
  try {
    return await work(dataSource);
  } finally {
    await dataSource.destroy();
  }
}
