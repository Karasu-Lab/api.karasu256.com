#!/usr/bin/env node
/**
 * Refreshes the app key pair that authenticates the accounts site's
 * internal calls to the API (see src/lib/api/internal in the accounts
 * repository and src/lib/app-auth in the API repository).
 *
 * One run generates a fresh Ed25519 key pair and registers every
 * value both deployments need, in both environments of each
 * repository:
 *
 * - Karasu-Lab/accounts.karasu256.com: the APP_ID variable and the
 *   APP_PRIVATE_KEY secret (the private half, base64-encoded PKCS#8)
 * - Karasu-Lab/api.karasu256.com: the ACCOUNTS_APP_ID variable and
 *   the ACCOUNTS_APP_PUBLIC_KEY variable (the public half,
 *   base64-encoded SPKI)
 *
 * The private key is passed to `gh` over standard input only: it is
 * never printed, written to disk, or passed as an argument. An
 * identical copy of this script lives in both repositories; keep the
 * two copies in sync.
 *
 * Rotation is not atomic across two repositories. If a run fails
 * partway, re-run it: a half-rotated pair rejects the internal calls
 * until both sides hold the same pair again. Registered values reach
 * the Workers at the next deployment of each repository, so
 * redeploy both after a refresh.
 *
 * Requires the GitHub CLI, authenticated with access to both
 * repositories. Usage: node scripts/refresh-app-key.mjs
 */
import { generateKeyPairSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const APP_ID = 'accounts.karasu256.com';
const ACCOUNTS_REPO = 'Karasu-Lab/accounts.karasu256.com';
const API_REPO = 'Karasu-Lab/api.karasu256.com';

/** Environment names as they exist in each repository. */
const ACCOUNTS_ENVIRONMENTS = ['Production', 'Preview'];
const API_ENVIRONMENTS = ['production', 'preview'];

function gh(args, input) {
  const result = spawnSync('gh', args, { input, encoding: 'utf8' });
  if (result.error) throw new Error(`failed to run gh: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`gh ${args.slice(0, 2).join(' ')} failed: ${result.stderr.trim()}`);
  }
  return result.stdout;
}

function setVariable(repo, env, name, value) {
  gh(['variable', 'set', name, '--repo', repo, '--env', env, '--body', value]);
  console.log(`set variable ${name} in ${repo} (${env})`);
}

function setSecretFromStdin(repo, env, name, value) {
  gh(['secret', 'set', name, '--repo', repo, '--env', env], value);
  console.log(`set secret ${name} in ${repo} (${env})`);
}

function assertListed(kind, repo, env, name) {
  const listing = gh([kind, 'list', '--repo', repo, '--env', env]);
  if (!listing.split('\n').some((line) => line.startsWith(`${name}\t`) || line.startsWith(`${name} `))) {
    throw new Error(`${kind} ${name} is not listed in ${repo} (${env}) after registration`);
  }
}

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const privateKeyBase64 = privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
const publicKeyBase64 = publicKey.export({ format: 'der', type: 'spki' }).toString('base64');

for (const env of ACCOUNTS_ENVIRONMENTS) {
  setVariable(ACCOUNTS_REPO, env, 'APP_ID', APP_ID);
  setSecretFromStdin(ACCOUNTS_REPO, env, 'APP_PRIVATE_KEY', privateKeyBase64);
}
for (const env of API_ENVIRONMENTS) {
  setVariable(API_REPO, env, 'ACCOUNTS_APP_ID', APP_ID);
  setVariable(API_REPO, env, 'ACCOUNTS_APP_PUBLIC_KEY', publicKeyBase64);
}

for (const env of ACCOUNTS_ENVIRONMENTS) {
  assertListed('variable', ACCOUNTS_REPO, env, 'APP_ID');
  assertListed('secret', ACCOUNTS_REPO, env, 'APP_PRIVATE_KEY');
}
for (const env of API_ENVIRONMENTS) {
  assertListed('variable', API_REPO, env, 'ACCOUNTS_APP_ID');
  assertListed('variable', API_REPO, env, 'ACCOUNTS_APP_PUBLIC_KEY');
}

console.log('App key pair refreshed in both repositories. Redeploy both repositories for the Workers to pick up the new values.');
