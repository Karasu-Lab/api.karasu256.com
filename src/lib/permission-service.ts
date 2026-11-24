import { PermissionService } from '@karasu-lab/api-permissions';
import { withDataSource } from '../db/data-source';
import { TypeOrmPermissionRepository } from '../db/typeorm-permission-repository';

export function withPermissionService<T>(env: Env, work: (service: PermissionService) => Promise<T>): Promise<T> {
  return withDataSource(env, (dataSource) => work(new PermissionService(new TypeOrmPermissionRepository(dataSource))));
}
