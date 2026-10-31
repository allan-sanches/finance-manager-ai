import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const validContent = JSON.stringify({
  transaction: {
    description: 'Jantar no iFood',
    amount: 45,
    type: 'expense',
    category: 'Alimentação',
    paymentMethod: 'credit_card',
    creditCardId: 'card-1',
    date: '2026-10-28',
    isFixed: false,
  },
  confidence: 'high',
});

const completion = (content: string | null, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

describe('extractWithDeepseek', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
    vi.stubEnv('DEEPSEEK_MODEL', 'deepseek-flash');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('retorna not_configured sem chave e não chama a API', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    const { extractWithDeepseek } = await import('@/lib/deepseek');
    const result = await extractWithDeepseek('oi');
    expect(result).toMatchObject({ ok: false, code: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia JSON mode com a chave no header e valida a resposta', async () => {
    fetchMock.mockResolvedValue(completion(validContent));
    const { extractWithDeepseek } = await import('@/lib/deepseek');
    const result = await extractWithDeepseek('Gastei 45 no iFood', [
      { id: 'card-1', name: 'Nubank' },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.transaction.creditCardId).toBe('card-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.deepseek.com/chat/completions');
    expect(init.headers.authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('deepseek-flash');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content).toContain('json');
    expect(body.messages[1]).toEqual({ role: 'user', content: 'Gastei 45 no iFood' });
  });

  it('retorna upstream_error quando a API responde com erro', async () => {
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));
    const { extractWithDeepseek } = await import('@/lib/deepseek');
    expect(await extractWithDeepseek('oi')).toMatchObject({ ok: false, code: 'upstream_error' });
  });

  it('retorna upstream_error em falha de rede', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    const { extractWithDeepseek } = await import('@/lib/deepseek');
    expect(await extractWithDeepseek('oi')).toMatchObject({ ok: false, code: 'upstream_error' });
  });

  it.each([[null], ['não é json'], [JSON.stringify({ transaction: {} })]])(
    'retorna invalid_output para conteúdo %s',
    async (content) => {
      fetchMock.mockResolvedValue(completion(content));
      const { extractWithDeepseek } = await import('@/lib/deepseek');
      expect(await extractWithDeepseek('oi')).toMatchObject({ ok: false, code: 'invalid_output' });
    },
  );
});

describe('generateJsonWithDeepseek com imagens', () => {
  it('recusa sem chamar a API, porque o DeepSeek só lê texto', async () => {
    vi.resetModules();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('DEEPSEEK_API_KEY', 'k');
    const { generateJsonWithDeepseek } = await import('@/lib/deepseek');
    const result = await generateJsonWithDeepseek({
      systemInstruction: 's',
      content: 'c',
      images: [{ mimeType: 'image/png', base64: 'AAA' }],
      geminiSchema: {},
      jsonExample: {},
      maxOutputTokens: 10,
    });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining('não lê imagens') });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
});

describe('chatJsonWithDeepseek', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('DEEPSEEK_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('manda o histórico inteiro em JSON mode e devolve o objeto', async () => {
    fetchMock.mockResolvedValue(completion(JSON.stringify({ reply: 'Oi, camarada!', transactions: [] })));
    const { chatJsonWithDeepseek } = await import('@/lib/deepseek');
    const messages = [
      { role: 'system' as const, content: 'responda em json' },
      { role: 'user' as const, content: 'oi' },
      { role: 'assistant' as const, content: '{"reply":"olá"}' },
      { role: 'user' as const, content: 'como estão meus gastos?' },
    ];
    const result = await chatJsonWithDeepseek(messages);

    expect(result).toEqual({ ok: true, value: { reply: 'Oi, camarada!', transactions: [] } });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual(messages);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.thinking).toEqual({ type: 'disabled' });
  });

  it('acusa JSON quebrado como invalid_output', async () => {
    fetchMock.mockResolvedValue(completion('{"reply": "cortado'));
    const { chatJsonWithDeepseek } = await import('@/lib/deepseek');
    const result = await chatJsonWithDeepseek([{ role: 'user', content: 'oi' }]);
    expect(result).toMatchObject({ ok: false, code: 'invalid_output' });
  });
});
