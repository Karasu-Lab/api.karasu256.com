import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * better-auth's `account` model — the providers a user has linked.
 * Column types are explicit because decorator metadata is not emitted.
 * Only the columns the internal endpoints read are mapped.
 */
@Entity({ name: 'account' })
export class Account {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'provider_id', type: 'text' })
  providerId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 128 })
  userId!: string;
}
