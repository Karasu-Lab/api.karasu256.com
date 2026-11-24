import { deleteAuthSession, fetchAuthSessions, fetchSessionDeviceSources, type AuthSession } from './auth-api';

export interface CombinedSession extends AuthSession {
  source: string | null;
}

export async function listActiveSessions(env: Env, userId: string, sessionId?: string): Promise<CombinedSession[]> {
  const [sessions, sources] = await Promise.all([
    fetchAuthSessions(env, userId, sessionId),
    fetchSessionDeviceSources(env, userId, sessionId),
  ]);
  const sourceBySessionId = new Map(sources.map((row) => [row.sessionId, row.source]));
  return sessions.map((session) => ({
    ...session,
    source: sourceBySessionId.get(session.id) ?? null,
  }));
}

export async function revokeActiveSession(env: Env, userId: string, sessionId: string): Promise<boolean> {
  return deleteAuthSession(env, userId, sessionId);
}
