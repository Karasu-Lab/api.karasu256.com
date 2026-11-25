import { z } from 'zod';
import { signRequest } from '@karasu-lab/utils/server';
import { vercelProtectionBypassHeaders } from '@karasu-lab/utils/server/vercel-bypass';
import { BadGatewayError } from './errors';

type OAuthProviderKind = 'social' | 'derived' | 'passkey';

interface OAuthProviderDefinition {
  id: string;
  label: string;
  kind: OAuthProviderKind;
  signIn: boolean;
  link: boolean;
  backgroundColor: { default: string; dark: string };
  foregroundColor: { default: string; dark: string };
  viewBox: string;
  path: string;
}

const oauthProviderDefinitions: OAuthProviderDefinition[] = [
  {
    id: 'google',
    label: 'Google',
    kind: 'social',
    signIn: true,
    link: true,
    backgroundColor: { default: '#f2f2f2', dark: '#ffffff' },
    foregroundColor: { default: '#1f1f1f', dark: '#1f1f1f' },
    viewBox: '0 0 512 512',
    path: 'M500 261.8C500 403.3 403.1 504 260 504 122.8 504 12 393.2 12 256S122.8 8 260 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9c-88.3-85.2-252.5-21.2-252.5 118.2 0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9l-140.8 0 0-85.3 236.1 0c2.3 12.7 3.9 24.9 3.9 41.4z',
  },
  {
    id: 'github',
    label: 'GitHub',
    kind: 'social',
    signIn: true,
    link: true,
    backgroundColor: { default: '#24292f', dark: '#24292f' },
    foregroundColor: { default: '#ffffff', dark: '#ffffff' },
    viewBox: '0 0 512 512',
    path: 'M216.5 362.5c-66-8-112.5-55.5-112.5-117 0-25 9-52 24-70-6.5-16.5-5.5-51.5 2-66 20-2.5 47 8 63 22.5 19-6 39-9 63.5-9s44.5 3 62.5 8.5c15.5-14 43-24.5 63-22 7 13.5 8 48.5 1.5 65.5 16 19 24.5 44.5 24.5 70.5 0 61.5-46.5 108-113.5 116.5 17 11 28.5 35 28.5 62.5l0 52C323 491.5 335.5 500 350.5 494 441 459.5 512 369 512 257 512 115.5 397 0 255.5 0S0 115.5 0 257c0 111 70.5 203 165.5 237.5 13.5 5 26.5-4 26.5-17.5l0-40c-7 3-16 5-24 5-33 0-52.5-18-66.5-51.5-5.5-13.5-11.5-21.5-23-23-6-.5-8-3-8-6 0-6 10-10.5 20-10.5 14.5 0 27 9 40 27.5 10 14.5 20.5 21 33 21s20.5-4.5 32-16c8.5-8.5 15-16 21-21z',
  },
  {
    id: 'microsoft',
    label: 'Microsoft',
    kind: 'social',
    signIn: true,
    link: true,
    backgroundColor: { default: '#00adef', dark: '#00adef' },
    foregroundColor: { default: '#ffffff', dark: '#ffffff' },
    viewBox: '0 0 448 512',
    path: 'M0 32l214.6 0 0 214.6-214.6 0 0-214.6zm233.4 0l214.6 0 0 214.6-214.6 0 0-214.6zM0 265.4l214.6 0 0 214.6-214.6 0 0-214.6zm233.4 0l214.6 0 0 214.6-214.6 0 0-214.6z',
  },
  {
    id: 'twitter',
    label: 'X',
    kind: 'social',
    signIn: true,
    link: true,
    backgroundColor: { default: '#000000', dark: '#000000' },
    foregroundColor: { default: '#ffffff', dark: '#ffffff' },
    viewBox: '0 0 448 512',
    path: 'M357.2 48L427.8 48 273.6 224.2 455 464 313 464 201.7 318.6 74.5 464 3.8 464 168.7 275.5-5.2 48 140.4 48 240.9 180.9 357.2 48zM332.4 421.8l39.1 0-252.4-333.8-42 0 255.3 333.8z',
  },
  {
    id: 'discord',
    label: 'Discord',
    kind: 'social',
    signIn: true,
    link: true,
    backgroundColor: { default: '#5865f2', dark: '#5865f2' },
    foregroundColor: { default: '#ffffff', dark: '#ffffff' },
    viewBox: '0 0 576 512',
    path: 'M492.5 69.8c-.2-.3-.4-.6-.8-.7-38.1-17.5-78.4-30-119.7-37.1-.4-.1-.8 0-1.1 .1s-.6 .4-.8 .8c-5.5 9.9-10.5 20.2-14.9 30.6-44.6-6.8-89.9-6.8-134.4 0-4.5-10.5-9.5-20.7-15.1-30.6-.2-.3-.5-.6-.8-.8s-.7-.2-1.1-.2c-41.3 7.1-81.6 19.6-119.7 37.1-.3 .1-.6 .4-.8 .7-76.2 113.8-97.1 224.9-86.9 334.5 0 .3 .1 .5 .2 .8s.3 .4 .5 .6c44.4 32.9 94 58 146.8 74.2 .4 .1 .8 .1 1.1 0s.7-.4 .9-.7c11.3-15.4 21.4-31.8 30-48.8 .1-.2 .2-.5 .2-.8s0-.5-.1-.8-.2-.5-.4-.6-.4-.3-.7-.4c-15.8-6.1-31.2-13.4-45.9-21.9-.3-.2-.5-.4-.7-.6s-.3-.6-.3-.9 0-.6 .2-.9 .3-.5 .6-.7c3.1-2.3 6.2-4.7 9.1-7.1 .3-.2 .6-.4 .9-.4s.7 0 1 .1c96.2 43.9 200.4 43.9 295.5 0 .3-.1 .7-.2 1-.2s.7 .2 .9 .4c2.9 2.4 6 4.9 9.1 7.2 .2 .2 .4 .4 .6 .7s.2 .6 .2 .9-.1 .6-.3 .9-.4 .5-.6 .6c-14.7 8.6-30 15.9-45.9 21.8-.2 .1-.5 .2-.7 .4s-.3 .4-.4 .7-.1 .5-.1 .8 .1 .5 .2 .8c8.8 17 18.8 33.3 30 48.8 .2 .3 .6 .6 .9 .7s.8 .1 1.1 0c52.9-16.2 102.6-41.3 147.1-74.2 .2-.2 .4-.4 .5-.6s.2-.5 .2-.8c12.3-126.8-20.5-236.9-86.9-334.5zm-302 267.7c-29 0-52.8-26.6-52.8-59.2s23.4-59.2 52.8-59.2c29.7 0 53.3 26.8 52.8 59.2 0 32.7-23.4 59.2-52.8 59.2zm195.4 0c-29 0-52.8-26.6-52.8-59.2s23.4-59.2 52.8-59.2c29.7 0 53.3 26.8 52.8 59.2 0 32.7-23.2 59.2-52.8 59.2z',
  },
  {
    id: 'xbox',
    label: 'Xbox',
    kind: 'derived',
    signIn: false,
    link: true,
    backgroundColor: { default: '#107c10', dark: '#107c10' },
    foregroundColor: { default: '#ffffff', dark: '#ffffff' },
    viewBox: '0 0 512 512',
    path: 'M369.9 318.2c44.3 54.3 64.7 98.8 54.4 118.7-7.9 15.1-56.7 44.6-92.6 55.9-29.6 9.3-68.4 13.3-100.4 10.2-38.2-3.7-76.9-17.4-110.1-39-27.9-18.2-34.2-25.7-34.2-40.6 0-29.9 32.9-82.3 89.2-142.1 32-33.9 76.5-73.7 81.4-72.6 9.4 2.1 84.3 75.1 112.3 109.5zM188.6 143.8c-29.7-26.9-58.1-53.9-86.4-63.4-15.2-5.1-16.3-4.8-28.7 8.1-29.2 30.4-53.5 79.7-60.3 122.4-5.4 34.2-6.1 43.8-4.2 60.5 5.6 50.5 17.3 85.4 40.5 120.9 9.5 14.6 12.1 17.3 9.3 9.9-4.2-11-.3-37.5 9.5-64 14.3-39 53.9-112.9 120.3-194.4zm311.6 63.5c-16.9-80-67.5-130.3-74.6-130.3-7.3 0-24.2 6.5-36 13.9-23.3 14.5-41 31.4-64.3 52.8 42.4 53.3 102.2 139.4 122.9 202.3 6.8 20.7 9.7 41.1 7.4 52.3-1.7 8.5-1.7 8.5 1.4 4.6 6.1-7.7 19.9-31.3 25.4-43.5 7.4-16.2 15-40.2 18.6-58.7 4.3-22.5 3.9-70.8-.8-93.4zM141.3 43c47.7-2.5 109.7 34.5 114.3 35.4 .7 .1 10.4-4.2 21.6-9.7 63.9-31.1 94-25.8 107.4-25.2-63.9-39.3-152.7-50-233.9-11.7-23.4 11.1-24 11.9-9.4 11.2z',
  },
  {
    id: 'minecraft',
    label: 'Minecraft',
    kind: 'derived',
    signIn: false,
    link: true,
    backgroundColor: { default: '#6a9c3f', dark: '#6a9c3f' },
    foregroundColor: { default: '#ffffff', dark: '#ffffff' },
    viewBox: '0 0 512 512',
    path: 'M224.3-2.5c19.8-11.4 44.2-11.4 64 0L464.2 99c19.8 11.4 32 32.6 32 55.4l0 203c0 22.9-12.2 44-32 55.4L288.3 514.5c-19.8 11.4-44.2 11.4-64 0L48.5 413c-19.8-11.4-32-32.6-32-55.4l0-203c0-22.9 12.2-44 32-55.4L224.3-2.5zm207.8 360l0-166.1-143.8 83 0 166.1 143.8-83z',
  },
  {
    id: 'passkey',
    label: 'Passkey',
    kind: 'passkey',
    signIn: true,
    link: false,
    backgroundColor: { default: '#f2f2f2', dark: '#27272a' },
    foregroundColor: { default: '#1f1f1f', dark: '#ffffff' },
    viewBox: '0 0 512 512',
    path: 'M48 256c0-114.9 93.1-208 208-208 63.1 0 119.6 28.1 157.8 72.5 8.6 10.1 23.8 11.2 33.8 2.6s11.2-23.8 2.6-33.8C403.3 34.6 333.7 0 256 0 114.6 0 0 114.6 0 256l0 40c0 13.3 10.7 24 24 24s24-10.7 24-24l0-40zm458.5-52.9c-2.7-13-15.5-21.3-28.4-18.5s-21.3 15.5-18.5 28.4c2.9 13.9 4.5 28.3 4.5 43.1l0 40c0 13.3 10.7 24 24 24s24-10.7 24-24l0-40c0-18.1-1.9-35.8-5.5-52.9zM256 80c-19 0-37.4 3-54.5 8.6-15.2 5-18.7 23.7-8.3 35.9 7.1 8.3 18.8 10.8 29.4 7.9 10.6-2.9 21.8-4.4 33.4-4.4 70.7 0 128 57.3 128 128l0 24.9c0 25.2-1.5 50.3-4.4 75.3-1.7 14.6 9.4 27.8 24.2 27.8 11.8 0 21.9-8.6 23.3-20.3 3.3-27.4 5-55 5-82.7l0-24.9c0-97.2-78.8-176-176-176zM150.7 148.7c-9.1-10.6-25.3-11.4-33.9-.4-23.1 29.8-36.8 67.1-36.8 107.7l0 24.9c0 24.2-2.6 48.4-7.8 71.9-3.4 15.6 7.9 31.1 23.9 31.1 10.5 0 19.9-7 22.2-17.3 6.4-28.1 9.7-56.8 9.7-85.8l0-24.9c0-27.2 8.5-52.4 22.9-73.1 7.2-10.4 8-24.6-.2-34.2zM256 160c-53 0-96 43-96 96l0 24.9c0 35.9-4.6 71.5-13.8 106.1-3.8 14.3 6.7 29 21.5 29 9.5 0 17.9-6.2 20.4-15.4 10.5-39 15.9-79.2 15.9-119.7l0-24.9c0-28.7 23.3-52 52-52s52 23.3 52 52l0 24.9c0 36.3-3.5 72.4-10.4 107.9-2.7 13.9 7.7 27.2 21.8 27.2 10.2 0 19-7 21-17 7.7-38.8 11.6-78.3 11.6-118.1l0-24.9c0-53-43-96-96-96zm24 96c0-13.3-10.7-24-24-24s-24 10.7-24 24l0 24.9c0 59.9-11 119.3-32.5 175.2l-5.9 15.3c-4.8 12.4 1.4 26.3 13.8 31s26.3-1.4 31-13.8l5.9-15.3C267.9 411.9 280 346.7 280 280.9l0-24.9z',
  },
];

const providerIdsSchema = z.object({ providerIds: z.array(z.string()) });

export interface OAuthProvider {
  id: string;
  label: string;
  kind: OAuthProviderKind;
  signIn: boolean;
  link: boolean;
  backgroundColor: { default: string; dark: string };
  foregroundColor: { default: string; dark: string };
  iconUrl: string;
}

export type OAuthProviderUsage = 'signIn' | 'link';

export function renderOAuthProviderSvg(providerId: string): string | null {
  const provider = oauthProviderDefinitions.find((definition) => definition.id === providerId);
  if (!provider) return null;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${provider.viewBox}" role="img" aria-label="${provider.label}"><path fill="currentColor" d="${provider.path}"/></svg>`;
}

async function fetchProviderIds(env: Env): Promise<string[]> {
  const url = `${env.AUTH_URL}/api/internal/providers`;
  const res = await fetch(url, {
    headers: {
      ...signRequest({ secret: env.INTERNAL_API_SECRET, method: 'GET', url, body: '' }),
      ...vercelProtectionBypassHeaders(env.VERCEL_PROTECTION_BYPASS_SECRET),
    },
  });
  if (!res.ok) throw new BadGatewayError(undefined, `api-auth.karasu256.com responded ${res.status} for ${url}`);
  const parsed = providerIdsSchema.safeParse(await res.json());
  if (!parsed.success) throw new BadGatewayError(undefined, 'api-auth.karasu256.com returned the providers in an unexpected shape');
  return parsed.data.providerIds;
}

export async function listOAuthProviders(env: Env, origin: string, usage?: OAuthProviderUsage): Promise<OAuthProvider[]> {
  const providerIds = new Set(await fetchProviderIds(env));
  const available = (definition: OAuthProviderDefinition) => providerIds.has(definition.id) && (!usage || definition[usage]);
  return oauthProviderDefinitions.filter(available).map(({ id, label, kind, signIn, link, backgroundColor, foregroundColor }) => ({
    id,
    label,
    kind,
    signIn,
    link,
    backgroundColor,
    foregroundColor,
    iconUrl: `${origin}/api/assets/oauth/providers/${id}`,
  }));
}
