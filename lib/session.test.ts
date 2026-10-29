import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SESSION_TTL_SECONDS,
  createSessionToken,
  isAuthConfigured,
  safeRedirectPath,
  verifyPassword,
  verifySessionToken,
} from '@/lib/session';

const SECRET = 'x'.repeat(40);

describe('session', () => {
  beforeEach(() => {
    vi.stubEnv('SESSION_SECRET', SECRET);
    vi.stubEnv('APP_PASSWORD', 'senha-forte');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('aceita um token recém-criado', async () => {
    const token = await createSessionToken();
    expect(await verifySessionToken(token)).toBe(true);
  });

  it('rejeita token expirado', async () => {
    const now = Date.now();
    const token = await createSessionToken(now);
    expect(await verifySessionToken(token, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBe(false);
  });

  it('rejeita token adulterado', async () => {
    const token = await createSessionToken();
    const [exp, sig] = token.split('.');
    expect(await verifySessionToken(`${Number(exp) + 1000}.${sig}`)).toBe(false);
    expect(await verifySessionToken(`${exp}.${sig}x`)).toBe(false);
    expect(await verifySessionToken('lixo')).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
  });

  it('rejeita token assinado com outro segredo', async () => {
    const token = await createSessionToken();
    vi.stubEnv('SESSION_SECRET', 'y'.repeat(40));
    expect(await verifySessionToken(token)).toBe(false);
  });

  it('não funciona com segredo curto', async () => {
    vi.stubEnv('SESSION_SECRET', 'curto');
    expect(isAuthConfigured()).toBe(false);
    await expect(createSessionToken()).rejects.toThrow();
    expect(await verifyPassword('senha-forte')).toBe(false);
  });

  it('confere a senha', async () => {
    expect(await verifyPassword('senha-forte')).toBe(true);
    expect(await verifyPassword('senha-errada')).toBe(false);
    expect(await verifyPassword('')).toBe(false);
  });
});

describe('safeRedirectPath', () => {
  it.each([
    ['/transacoes', '/transacoes'],
    ['/listas?x=1', '/listas?x=1'],
    ['//evil.com', '/'],
    ['/\\evil.com', '/'],
    ['https://evil.com', '/'],
    [undefined, '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});
