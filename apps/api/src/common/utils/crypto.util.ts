import { createHash, randomBytes } from 'node:crypto';

export function generateApiKey() {
  const raw = `mhub_${randomBytes(24).toString('hex')}`;

  return {
    raw,
    hashed: createHash('sha256').update(raw).digest('hex'),
    prefix: raw.slice(0, 9),
    lastFour: raw.slice(-4),
  };
}

export function generateSigningSecret() {
  return `whsec_${randomBytes(24).toString('hex')}`;
}
