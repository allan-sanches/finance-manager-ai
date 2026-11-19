// O request.formData() carrega o corpo inteiro na memória antes de dar para ver o tamanho dos
// arquivos. Aqui o corpo é lido com teto: recusa pelo Content-Length quando ele vem e, de qualquer
// jeito, para de ler assim que passa do limite (o header pode faltar entre o proxy e o app).

export type LimitedFormData =
  | { ok: true; form: FormData }
  | { ok: false; reason: 'too_large' | 'invalid' };

export async function readLimitedFormData(request: Request, maxBytes: number): Promise<LimitedFormData> {
  const declared = request.headers.get('content-length');
  if (declared !== null && Number(declared) > maxBytes) return { ok: false, reason: 'too_large' };
  if (!request.body) return { ok: false, reason: 'invalid' };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return { ok: false, reason: 'too_large' };
    }
    chunks.push(value);
  }

  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const form = await new Response(body, {
      headers: { 'content-type': request.headers.get('content-type') ?? '' },
    }).formData();
    return { ok: true, form };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
