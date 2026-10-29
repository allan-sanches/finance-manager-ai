import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPasswordHash } from '@/lib/password';

describe('password', () => {
  it('confere a senha certa e rejeita a errada', async () => {
    const stored = await hashPassword('nova-senha-forte');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPasswordHash('nova-senha-forte', stored)).toBe(true);
    expect(await verifyPasswordHash('nova-senha-fortE', stored)).toBe(false);
  });

  it('usa salt diferente a cada hash', async () => {
    expect(await hashPassword('igual')).not.toBe(await hashPassword('igual'));
  });

  it('rejeita hash em formato desconhecido', async () => {
    expect(await verifyPasswordHash('x', 'lixo')).toBe(false);
    expect(await verifyPasswordHash('x', 'bcrypt$1$2$3$a$b')).toBe(false);
  });
});
