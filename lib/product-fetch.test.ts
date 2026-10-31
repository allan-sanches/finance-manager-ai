import { describe, expect, it } from 'vitest';

import { assertFetchableUrl, isPublicAddress } from '@/lib/product-fetch';

describe('isPublicAddress', () => {
  it.each(['127.0.0.1', '10.1.2.3', '172.16.0.9', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1'])(
    'bloqueia %s',
    (ip) => expect(isPublicAddress(ip)).toBe(false),
  );

  it.each(['8.8.8.8', '151.101.1.1', '2606:4700::1111'])('libera %s', (ip) => expect(isPublicAddress(ip)).toBe(true));
});

describe('assertFetchableUrl', () => {
  it('aceita http(s) nas portas padrão', () => {
    expect(assertFetchableUrl('https://loja.example/p').hostname).toBe('loja.example');
  });

  it.each([
    'file:///etc/passwd',
    'ftp://loja.example/',
    'http://localhost:3000/',
    'http://127.0.0.1/',
    'http://[::1]/',
    'https://loja.example:8443/',
    'https://user:senha@loja.example/',
    'http://metadata.google.internal/',
  ])('recusa %s', (url) => {
    expect(() => assertFetchableUrl(url)).toThrow();
  });
});
