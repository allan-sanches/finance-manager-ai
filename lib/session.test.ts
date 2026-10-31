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

  it('aceita um token recém-criado e devolve o usuário', async () => {
    const token = await createSessionToken('owner');
    expect(await verifySessionToken(token)).toBe('owner');
  });

  it('rejeita token expirado', async () => {
    const now = Date.now();
    const token = await createSessionToken('owner', now);
    expect(await verifySessionToken(token, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
  });

  it('rejeita token adulterado', async () => {
    const token = await createSessionToken('owner');
    const [user, exp, sig] = token.split('.');
    expect(await verifySessionToken(`${user}.${Number(exp) + 1000}.${sig}`)).toBeNull();
    expect(await verifySessionToken(`${user}.${exp}.${sig}x`)).toBeNull();
    expect(await verifySessionToken('lixo')).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it('não deixa trocar o usuário de um token válido', async () => {
    const token = await createSessionToken('owner');
    const [, exp, sig] = token.split('.');
    expect(await verifySessionToken(`outro-usuario.${exp}.${sig}`)).toBeNull();
    expect(await verifySessionToken(`${exp}.${sig}`)).toBeNull();
    await expect(createSessionToken('a.b')).rejects.toThrow();
  });

  it('rejeita token assinado com outro segredo', async () => {
    const token = await createSessionToken('owner');
    vi.stubEnv('SESSION_SECRET', 'y'.repeat(40));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('não funciona com segredo curto', async () => {
    vi.stubEnv('SESSION_SECRET', 'curto');
    expect(isAuthConfigured()).toBe(false);
    await expect(createSessionToken('owner')).rejects.toThrow();
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
