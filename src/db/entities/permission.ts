import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'permissions' })
export class Permission {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ name: 'public_id', type: 'text' })
  publicId!: string;

  @Column({ name: 'numeric_id', type: 'integer' })
  numericId!: number;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt!: Date | null;
}
