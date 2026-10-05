import { Column, Entity, PrimaryColumn } from 'typeorm';

/** Column types are explicit because decorator metadata is not emitted, and the schema is owned by accounts' drizzle migrations. */
@Entity({ name: 'users' })
export class User {
  @PrimaryColumn({ type: 'varchar', length: 128 })
  id!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  image!: string | null;

  @Column({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
