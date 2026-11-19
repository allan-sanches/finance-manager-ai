import { beforeAll, describe, expect, it, vi } from 'vitest';

const sessionMock = vi.hoisted(() => vi.fn(async (): Promise<string | null> => 'owner'));
vi.mock('@/lib/auth', () => ({ getSessionUserId: sessionMock }));
vi.mock('@/lib/categories-server', () => ({ userCategoryNames: async () => ['Outros'] }));

const LIMIT = 8 * 5 * 1024 * 1024 + 256 * 1024;

const post = (headers: Record<string, string>, body: BodyInit = 'x') =>
  new Request('http://localhost/api/import', { method: 'POST', headers, body });

// A leitura com teto em si é testada em lib/request-body.test.ts; aqui, que a rota a usa.
describe('POST /api/import — tamanho do corpo', () => {
  // A rota carrega a leitura de PDF: o primeiro import é lento, então acontece uma vez só.
  // São menos chamadas que o limite da conta (10/min), que fica na mesma instância.
  let POST: (request: Request) => Promise<Response>;
  beforeAll(async () => {
    ({ POST } = await import('./route'));
  }, 30_000);

  it('recusa com 413 corpo declarado acima do teto', async () => {
    const res = await POST(post({ 'content-length': String(LIMIT + 1) }));
    expect(res.status).toBe(413);
  });

  it('corpo que não é multipart dá 400', async () => {
    const res = await POST(post({ 'content-type': 'text/plain' }));
    expect(res.status).toBe(400);
  });

  it('multipart dentro do teto segue para a validação do tipo', async () => {
    const form = new FormData();
    form.set('kind', 'tipo-que-nao-existe');
    form.set('file', new File(['a'], 'a.csv'));
    const res = await POST(new Request('http://localhost/api/import', { method: 'POST', body: form }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'Tipo de importação inválido.' });
  });

  it('confere a sessão antes do tamanho', async () => {
    sessionMock.mockResolvedValueOnce(null);
    const res = await POST(post({ 'content-length': String(LIMIT + 1) }));
    expect(res.status).toBe(401);
  });
});
