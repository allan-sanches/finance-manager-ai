import { beforeEach, describe, expect, it, vi } from 'vitest';

const extractMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai', () => ({
  extractTransactionFromText: extractMock,
  resolveAiProvider: (saved?: string) => (saved === 'deepseek' ? 'deepseek' : 'gemini'),
}));
const sessionMock = vi.hoisted(() => vi.fn(async (): Promise<string | null> => 'owner'));
vi.mock('@/lib/auth', () => ({ getSessionUserId: sessionMock }));
vi.mock('@/lib/categories-server', () => ({
  userCategoryNames: async () => ['Alimentação', 'Pet', 'Outros'],
}));

const post = (body: unknown, ip = '10.0.0.1', cookie?: string) =>
  new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      ...(cookie ? { cookie } : {}),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.resetModules();
    extractMock.mockReset();
  });

  it('retorna 401 sem sessão válida (ex.: senha trocada em outro aparelho)', async () => {
    sessionMock.mockResolvedValueOnce(null);
    const { POST } = await import('./route');
    const res = await POST(post({ message: 'oi' }));
    expect(res.status).toBe(401);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('retorna 400 para JSON malformado', async () => {
    const { POST } = await import('./route');
    const res = await POST(post('{nope'));
    expect(res.status).toBe(400);
  });

  it('retorna 400 sem message', async () => {
    const { POST } = await import('./route');
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    expect(extractMock).not.toHaveBeenCalled();
  });

  it('repassa mensagem e cartões validados para a extração', async () => {
    extractMock.mockResolvedValue({ ok: true, data: { transaction: {}, confidence: 'high' } });
    const { POST } = await import('./route');
    const res = await POST(post({ message: ' oi ', creditCards: [{ id: 'c1', name: 'Nubank' }] }));
    expect(res.status).toBe(200);
    expect(extractMock).toHaveBeenCalledWith('gemini', 'oi', [{ id: 'c1', name: 'Nubank' }], [
      'Alimentação',
      'Pet',
      'Outros',
    ]);
  });

  it('usa o provedor salvo no cookie de configurações', async () => {
    extractMock.mockResolvedValue({ ok: true, data: { transaction: {}, confidence: 'high' } });
    const { POST } = await import('./route');
    const res = await POST(post({ message: 'oi' }, '10.0.0.2', 'fm_session=x; fm_ai_provider=deepseek'));
    expect(res.status).toBe(200);
    expect(extractMock).toHaveBeenCalledWith('deepseek', 'oi', [], ['Alimentação', 'Pet', 'Outros']);
  });

  it.each([
    ['not_configured', 503],
    ['invalid_output', 422],
    ['upstream_error', 502],
  ])('mapeia %s para %i sem vazar o código', async (code, status) => {
    extractMock.mockResolvedValue({ ok: false, code, error: 'msg' });
    const { POST } = await import('./route');
    const res = await POST(post({ message: 'oi' }));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, error: 'msg' });
  });

  it('retorna 429 ao estourar o limite da conta', async () => {
    extractMock.mockResolvedValue({ ok: true, data: {} });
    const { POST } = await import('./route');
    for (let i = 0; i < 10; i++) {
      expect((await POST(post({ message: 'oi' }, '9.9.9.9'))).status).toBe(200);
    }
    const res = await POST(post({ message: 'oi' }, '9.9.9.9'));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBeTruthy();
  });

  it('trocar o X-Forwarded-For não renova o limite', async () => {
    extractMock.mockResolvedValue({ ok: true, data: {} });
    const { POST } = await import('./route');
    for (let i = 0; i < 10; i++) {
      expect((await POST(post({ message: 'oi' }, `9.9.9.${i}`))).status).toBe(200);
    }
    expect((await POST(post({ message: 'oi' }, '8.8.8.8'))).status).toBe(429);
  });

  it('o limite de uma conta não bloqueia outra', async () => {
    extractMock.mockResolvedValue({ ok: true, data: {} });
    const { POST } = await import('./route');
    for (let i = 0; i < 10; i++) await POST(post({ message: 'oi' }));
    expect((await POST(post({ message: 'oi' }))).status).toBe(429);
    sessionMock.mockResolvedValueOnce('outra-conta');
    expect((await POST(post({ message: 'oi' }))).status).toBe(200);
  });
});
