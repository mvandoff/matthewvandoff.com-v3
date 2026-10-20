/**
 * Lambda entry point: wires the real AWS clients into the handler. Bundled to dist-fetcher/index.mjs by
 * `pnpm fetcher:build`. Configured through BUCKET, API_KEY_PARAM and USERNAME_PARAM; the region comes from Lambda.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';
import { createHandler } from './handler.ts';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const handler = createHandler({
  s3: new S3Client({}),
  ssm: new SSMClient({}),
  fetch,
  now: () => new Date(),
  env: { BUCKET: requireEnv('BUCKET'), API_KEY_PARAM: requireEnv('API_KEY_PARAM'), USERNAME_PARAM: requireEnv('USERNAME_PARAM') },
});
