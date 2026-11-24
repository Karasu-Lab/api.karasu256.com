/** Shared with accounts' CDN uploads so each user keeps a single avatar. */
export function avatarKey(userId: string): string {
  return `users/${userId}/avatar.png`;
}
