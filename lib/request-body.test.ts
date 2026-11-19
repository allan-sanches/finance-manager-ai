import { describe, expect, it, vi } from 'vitest';

import { readLimitedFormData } from '@/lib/request-body';

/** Corpo em partes, sem Content-Length (como pode chegar depois de um proxy). */
function streamed(chunks: string[], contentType = 'text/plain'): { request: Request; pulled: () => number } {
  let pulled = 0;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (pulled === chunks.length) return controller.close();
      controller.enqueue(encoder.encode(chunks[pulled++]));
    },
  });
  const request = new Request('http://x/api/import', {
    method: 'POST',
    headers: { 'content-type': contentType },
    body,
    duplex: 'half',
  } as RequestInit);
  return { request, pulled: () => pulled };
}

describe('readLimitedFormData', () => {
  it('lê um multipart normal', async () => {
    const form = new FormData();
    form.set('kind', 'statement');
    form.set('file', new File(['conteúdo'], 'extrato.csv', { type: 'text/csv' }));
    const request = new Request('http://x', { method: 'POST', body: form });

    const result = await readLimitedFormData(request, 10_000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.form.get('kind')).toBe('statement');
    expect(await (result.form.get('file') as File).text()).toBe('conteúdo');
  });

  it('recusa pelo Content-Length sem ler o corpo', async () => {
    const request = new Request('http://x', {
      method: 'POST',
      headers: { 'content-length': '5000' },
      body: 'x',
    });
    const read = vi.spyOn(request.body!, 'getReader');
    expect(await readLimitedFormData(request, 1000)).toEqual({ ok: false, reason: 'too_large' });
    expect(read).not.toHaveBeenCalled();
  });

  it('sem Content-Length, para de ler assim que passa do teto', async () => {
    const { request, pulled } = streamed(['a'.repeat(400), 'b'.repeat(400), 'c'.repeat(400), 'd'.repeat(400)]);
    expect(await readLimitedFormData(request, 1000)).toEqual({ ok: false, reason: 'too_large' });
    expect(pulled()).toBeLessThan(4);
  });

  it('corpo que não é multipart dá invalid', async () => {
    const { request } = streamed(['não é formulário']);
    expect(await readLimitedFormData(request, 1000)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('sem corpo dá invalid', async () => {
    const request = new Request('http://x', { method: 'POST' });
    expect(await readLimitedFormData(request, 1000)).toEqual({ ok: false, reason: 'invalid' });
  });
});
