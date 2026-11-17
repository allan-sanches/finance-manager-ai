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
    const token = await createSessionToken('owner', 0);
    expect(await verifySessionToken(token)).toEqual({ userId: 'owner', version: 0 });
  });

  it('rejeita token expirado', async () => {
    const now = Date.now();
    const token = await createSessionToken('owner', 0, now);
    expect(await verifySessionToken(token, now + (SESSION_TTL_SECONDS + 1) * 1000)).toBeNull();
  });

  it('rejeita token adulterado', async () => {
    const token = await createSessionToken('owner', 0);
    const [user, exp, sig] = token.split('.');
    expect(await verifySessionToken(`${user}.${Number(exp) + 1000}.${sig}`)).toBeNull();
    expect(await verifySessionToken(`${user}.${exp}.${sig}x`)).toBeNull();
    expect(await verifySessionToken('lixo')).toBeNull();
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  it('não deixa trocar o usuário de um token válido', async () => {
    const token = await createSessionToken('owner', 0);
    const [, exp, sig] = token.split('.');
    expect(await verifySessionToken(`outro-usuario.${exp}.${sig}`)).toBeNull();
    expect(await verifySessionToken(`${exp}.${sig}`)).toBeNull();
    await expect(createSessionToken('a.b', 0)).rejects.toThrow();
  });

  it('não deixa trocar a versão de um token válido', async () => {
    const token = await createSessionToken('owner', 3);
    const [user, , exp, sig] = token.split('.');
    expect(await verifySessionToken(token)).toEqual({ userId: 'owner', version: 3 });
    expect(await verifySessionToken(`${user}.4.${exp}.${sig}`)).toBeNull();
    await expect(createSessionToken('owner', -1)).rejects.toThrow();
  });

  it('rejeita o formato antigo, sem versão', async () => {
    const token = await createSessionToken('owner', 0);
    const [user, , exp, sig] = token.split('.');
    expect(await verifySessionToken(`${user}.${exp}.${sig}`)).toBeNull();
  });

  it('rejeita token assinado com outro segredo', async () => {
    const token = await createSessionToken('owner', 0);
    vi.stubEnv('SESSION_SECRET', 'y'.repeat(40));
    expect(await verifySessionToken(token)).toBeNull();
  });

  it('não funciona com segredo curto', async () => {
    vi.stubEnv('SESSION_SECRET', 'curto');
    expect(isAuthConfigured()).toBe(false);
    await expect(createSessionToken('owner', 0)).rejects.toThrow();
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
