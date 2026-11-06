import type { AuthSession, SessionSource } from '@karasu-lab/types/shared';
import { deleteAuthSession, fetchAuthSessions, fetchSessionDeviceSources } from './auth-api';

export interface CombinedSession extends AuthSession {
  source: SessionSource;
}

const MOBILE_USER_AGENT = /(Mobi|Android|iPhone|iPad)/i;
const DESKTOP_USER_AGENT = /Electron/i;
const BROWSER_USER_AGENT = /Mozilla\//i;

function sourceFromUserAgent(userAgent: string | null): SessionSource {
  const value = userAgent ?? '';
  if (MOBILE_USER_AGENT.test(value)) return 'mobile';
  if (DESKTOP_USER_AGENT.test(value)) return 'desktop';
  if (BROWSER_USER_AGENT.test(value)) return 'browser';
  return 'app';
}

export async function listActiveSessions(env: Env, userId: string): Promise<CombinedSession[]> {
  const [sessions, sources] = await Promise.all([fetchAuthSessions(env, userId), fetchSessionDeviceSources(env, userId)]);
  const sourceBySessionId = new Map(sources.map((row) => [row.sessionId, row.source]));
  return sessions.map((session) => ({
    ...session,
    source: sourceBySessionId.get(session.id) ?? sourceFromUserAgent(session.userAgent),
  }));
}

export async function revokeActiveSession(env: Env, userId: string, sessionId: string): Promise<boolean> {
  return deleteAuthSession(env, userId, sessionId);
}
