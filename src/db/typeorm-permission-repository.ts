import { In, IsNull, type DataSource } from 'typeorm';
import type { GrantedPermissionRecord, PermissionRecord, PermissionRepository } from '@Hashibutogarasu/api-permissions';
import { ApiKeyPermission } from './entities/api-key-permission';
import { Permission } from './entities/permission';

function toRecord(permission: Permission): PermissionRecord {
  return { id: permission.id, publicId: permission.publicId, numericId: permission.numericId };
}

export class TypeOrmPermissionRepository implements PermissionRepository {
  private readonly dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  async findActive(): Promise<PermissionRecord[]> {
    const rows = await this.dataSource.getRepository(Permission).find({ where: { deletedAt: IsNull() }, order: { numericId: 'ASC' } });
    return rows.map(toRecord);
  }

  async findActiveByPublicIds(publicIds: readonly string[]): Promise<PermissionRecord[]> {
    const rows = await this.dataSource.getRepository(Permission).findBy({ publicId: In([...publicIds]), deletedAt: IsNull() });
    return rows.map(toRecord);
  }

  async grant(apiKeyId: string, permissionIds: readonly string[]): Promise<void> {
    await this.dataSource.getRepository(ApiKeyPermission).insert(permissionIds.map((permissionId) => ({ apiKeyId, permissionId })));
  }

  async findGranted(apiKeyIds: readonly string[]): Promise<GrantedPermissionRecord[]> {
    const rows = await this.dataSource.getRepository(ApiKeyPermission).find({
      where: { apiKeyId: In([...apiKeyIds]), permission: { deletedAt: IsNull() } },
      relations: { permission: true },
    });
    return rows.map((row) => ({ apiKeyId: row.apiKeyId, permission: toRecord(row.permission) }));
  }
}
