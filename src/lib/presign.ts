import { createHash, createHmac } from 'node:crypto';

function encodeSegment(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

export function presignUploadUrl(env: Env, path: string, contentType: string): string {
  const endpoint = new URL(env.STORAGE_ENDPOINT);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;

  const canonicalUri = `${endpoint.pathname.replace(/\/$/, '')}/${encodeSegment(env.STORAGE_BUCKET)}/${path.split('/').map(encodeSegment).join('/')}`;
  const signedHeaders = 'content-type;host';
  const canonicalQueryString = (
    [
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Content-Sha256', 'UNSIGNED-PAYLOAD'],
      ['X-Amz-Credential', `${env.STORAGE_ACCESS_KEY_ID}/${credentialScope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', '300'],
      ['X-Amz-SignedHeaders', signedHeaders],
    ] as const
  )
    .map(([key, value]) => `${encodeSegment(key)}=${encodeSegment(value)}`)
    .join('&');

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQueryString,
    `content-type:${contentType}\nhost:${endpoint.host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const signingKey = hmac(hmac(hmac(hmac(`AWS4${env.STORAGE_SECRET_ACCESS_KEY}`, dateStamp), 'auto'), 's3'), 'aws4_request');
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')].join('\n');
  const signature = hmac(signingKey, stringToSign).toString('hex');

  return `${endpoint.origin}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
}
