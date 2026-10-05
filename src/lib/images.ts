export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Shared with accounts' CDN uploads so each user keeps a single avatar. */
export function avatarKey(userId: string): string {
  return `users/${userId}/avatar.png`;
}
