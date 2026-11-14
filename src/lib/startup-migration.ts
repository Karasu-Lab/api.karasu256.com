import type { DataSource } from 'typeorm';
import { withDataSource } from '../db/data-source';
import { FirebaseUser } from '../db/entities/firebase-user';
import { User } from '../db/entities/user';
import { avatarPath } from './avatars';
import { cdnUrl, getCdnFile, inspectObject, upsertCdnFile } from './cdn-files';
import { getFirebasePhotoURL, setFirebasePhotoURL } from './firebase';

const BATCH_SIZE = 50;
const LEASE_MS = 60_000;

interface AvatarMigration {
  name: string;
  prefix: string;
  source: RegExp;
  target: (userId: string) => string;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS cdn_files (
    path TEXT PRIMARY KEY,
    sha256 TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    uploader_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS cdn_files_uploader_id_idx ON cdn_files (uploader_id)',
  `CREATE TABLE IF NOT EXISTS cdn_migrations (
    name TEXT PRIMARY KEY,
    cursor TEXT,
    lease_until INTEGER,
    completed_at TEXT
  )`,
];

function pointsTo(url: string | null | undefined, legacyUrl: string): boolean {
  return !!url && url.split('?')[0] === legacyUrl;
}

async function migrateAvatar(env: Env, dataSource: DataSource, migration: AvatarMigration, key: string): Promise<void> {
  const match = migration.source.exec(key);
  if (!match) return;
  const userId = match[1];
  const source = await inspectObject(env, key);
  if (!source) return;

  const target = migration.target(userId);
  const existing = await getCdnFile(env, target);
  if (existing?.sha256 !== source.sha256) {
    await env.CLOUDFLARE_IMAGES.put(target, source.body, { httpMetadata: source.httpMetadata });
    await upsertCdnFile(env, {
      path: target,
      sha256: source.sha256,
      contentType: source.contentType,
      size: source.size,
      uploaderId: userId,
    });
  }

  const legacyUrl = cdnUrl(env, key);
  const nextUrl = `${cdnUrl(env, target)}?v=${source.sha256.slice(0, 16)}`;

  const users = dataSource.getRepository(User);
  const user = await users.findOne({ where: { id: userId }, select: { id: true, image: true } });
  if (pointsTo(user?.image, legacyUrl)) {
    await users.update({ id: userId }, { image: nextUrl, updatedAt: new Date() });
  }

  const link = await dataSource
    .getRepository(FirebaseUser)
    .findOne({ where: { userId }, select: { firebaseUid: true } });
  if (!link?.firebaseUid) return;
  if (pointsTo(await getFirebasePhotoURL(env, link.firebaseUid), legacyUrl)) {
    await setFirebasePhotoURL(env, link.firebaseUid, nextUrl);
  }
}

async function runAvatarMigration(env: Env, migration: AvatarMigration): Promise<boolean> {
  const db = env.CDN_DB;
  const state = await db
    .prepare('SELECT completed_at FROM cdn_migrations WHERE name = ?')
    .bind(migration.name)
    .first<{ completed_at: string | null }>();
  if (state?.completed_at) return true;

  await db.prepare('INSERT OR IGNORE INTO cdn_migrations (name) VALUES (?)').bind(migration.name).run();
  const now = Date.now();
  const lease = await db
    .prepare(
      `UPDATE cdn_migrations SET lease_until = ?
       WHERE name = ? AND completed_at IS NULL AND (lease_until IS NULL OR lease_until < ?)
       RETURNING name, cursor`
    )
    .bind(now + LEASE_MS, migration.name, now)
    .first<{ name: string; cursor: string | null }>();
  if (!lease) return false;

  const listed = await env.CLOUDFLARE_IMAGES.list({
    prefix: migration.prefix,
    limit: BATCH_SIZE,
    ...(lease.cursor ? { cursor: lease.cursor } : {}),
  });

  if (listed.objects.some((object) => migration.source.test(object.key))) {
    await withDataSource(env, async (dataSource) => {
      for (const object of listed.objects) {
        try {
          await migrateAvatar(env, dataSource, migration, object.key);
        } catch (error) {
          console.error(`Startup migration ${migration.name} failed for ${object.key}`, error);
        }
      }
    });
  }

  if (listed.truncated) {
    await db
      .prepare('UPDATE cdn_migrations SET cursor = ?, lease_until = NULL WHERE name = ?')
      .bind(listed.cursor, migration.name)
      .run();
    return false;
  }
  await db
    .prepare('UPDATE cdn_migrations SET cursor = NULL, lease_until = NULL, completed_at = ? WHERE name = ?')
    .bind(new Date().toISOString(), migration.name)
    .run();
  return true;
}

export async function runStartupMigrations(env: Env): Promise<void> {
  const db = env.CDN_DB;
  await db.batch(SCHEMA_STATEMENTS.map((statement) => db.prepare(statement)));
  const legacyMigrated = await runAvatarMigration(env, {
    name: 'avatars-v1',
    prefix: 'users/',
    source: /^users\/([^/]+)\/avatar\.png$/,
    target: (userId) => `u/profiles/${userId}/avatar.png`,
  });
  if (!legacyMigrated) return;
  await runAvatarMigration(env, {
    name: 'avatars-v2',
    prefix: 'u/profiles/',
    source: /^u\/profiles\/([^/]+)\/avatar\.png$/,
    target: (userId) => avatarPath(userId, 'default'),
  });
}
