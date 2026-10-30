import { Type } from '@google/genai';
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

describe('AI Gateway', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key');
    vi.stubEnv('AI_GATEWAY_MODEL', 'deepseek/deepseek-v4.1-flash');
    vi.stubEnv('AI_GATEWAY_ZERO_DATA_RETENTION', '');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('retorna not_configured sem chave e não chama a API', async () => {
    vi.stubEnv('AI_GATEWAY_API_KEY', '');
    const { extractWithGateway } = await import('@/lib/ai-gateway');
    expect(await extractWithGateway('oi')).toMatchObject({ ok: false, code: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('envia json_schema com o modelo do gateway e valida a resposta', async () => {
    fetchMock.mockResolvedValue(completion(validContent));
    const { extractWithGateway } = await import('@/lib/ai-gateway');
    const result = await extractWithGateway('Gastei 45 no iFood', [{ id: 'card-1', name: 'Nubank' }]);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.transaction.creditCardId).toBe('card-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ai-gateway.vercel.sh/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('deepseek/deepseek-v4.1-flash');
    expect(body.response_format.type).toBe('json_schema');
    const schema = body.response_format.json_schema.schema;
    expect(schema.properties.transaction.properties.creditCardId).toMatchObject({
      type: ['string', 'null'],
      enum: ['card-1', null],
    });
    expect(body.providerOptions).toBeUndefined();
  });

  it('pede retenção zero quando AI_GATEWAY_ZERO_DATA_RETENTION=true', async () => {
    vi.stubEnv('AI_GATEWAY_ZERO_DATA_RETENTION', 'true');
    fetchMock.mockResolvedValue(completion(validContent));
    const { extractWithGateway } = await import('@/lib/ai-gateway');
    await extractWithGateway('oi');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.providerOptions).toEqual({ gateway: { zeroDataRetention: true } });
  });

  it('retorna upstream_error quando o gateway responde com erro ou a rede cai', async () => {
    const { extractWithGateway } = await import('@/lib/ai-gateway');
    fetchMock.mockResolvedValueOnce(new Response('no providers', { status: 403 }));
    expect(await extractWithGateway('oi')).toMatchObject({
      ok: false,
      code: 'upstream_error',
      error: expect.stringContaining('AI_GATEWAY_MODEL'),
    });
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await extractWithGateway('oi')).toMatchObject({ ok: false, code: 'upstream_error' });
  });

  it.each([[null], ['não é json'], [JSON.stringify({ transaction: {} })]])(
    'retorna invalid_output para conteúdo %s',
    async (content) => {
      fetchMock.mockResolvedValue(completion(content));
      const { extractWithGateway } = await import('@/lib/ai-gateway');
      expect(await extractWithGateway('oi')).toMatchObject({ ok: false, code: 'invalid_output' });
    },
  );

  it('converte schema do Gemini em JSON Schema', async () => {
    const { toJsonSchema } = await import('@/lib/ai-gateway');
    expect(
      toJsonSchema({
        type: Type.OBJECT,
        required: ['entries'],
        properties: {
          entries: {
            type: Type.ARRAY,
            items: { type: Type.NUMBER, description: 'valor' },
          },
          when: { type: Type.STRING, nullable: true },
        },
      }),
    ).toEqual({
      type: 'object',
      required: ['entries'],
      properties: {
        entries: { type: 'array', items: { type: 'number', description: 'valor' } },
        when: { type: ['string', 'null'] },
      },
    });
  });
});

describe('AI Gateway com imagens', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('AI_GATEWAY_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('manda texto + imagens como conteúdo multimodal', async () => {
    fetchMock.mockResolvedValue(completion(JSON.stringify({ entries: [] })));
    const { generateJsonWithGateway } = await import('@/lib/ai-gateway');
    const result = await generateJsonWithGateway({
      systemInstruction: 's',
      content: 'prints',
      images: [{ mimeType: 'image/jpeg', base64: 'AAA' }],
      geminiSchema: { type: Type.OBJECT },
      jsonExample: {},
      maxOutputTokens: 100,
    });
    expect(result.ok).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages[1].content).toEqual([
      { type: 'text', text: 'prints' },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } },
    ]);
  });
});
