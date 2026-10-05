import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Permission } from './permission';

@Entity({ name: 'api_key_permissions' })
export class ApiKeyPermission {
  @PrimaryColumn({ name: 'api_key_id', type: 'text' })
  apiKeyId!: string;

  @PrimaryColumn({ name: 'permission_id', type: 'text' })
  permissionId!: string;

  @ManyToOne(() => Permission)
  @JoinColumn({ name: 'permission_id' })
  permission!: Permission;
}
