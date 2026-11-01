import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * The loose link between a better-auth user and its Firebase Auth user.
 * Column types are explicit because decorator metadata is not emitted.
 * `firebaseUid` stays null until the link is established.
 */
@Entity({ name: 'firebase_user' })
export class FirebaseUser {
  @PrimaryColumn({ name: 'user_id', type: 'varchar', length: 128 })
  userId!: string;

  @Column({ name: 'firebase_uid', type: 'varchar', length: 128, nullable: true })
  firebaseUid!: string | null;
}
