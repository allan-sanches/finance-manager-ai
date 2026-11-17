import { NextResponse } from 'next/server';
import { z } from 'zod';

import { isAiProviderConfigured, resolveAiProvider, type ExtractionErrorCode } from '@/lib/ai';
import { AI_PROVIDER_COOKIE } from '@/lib/ai-provider';
import { getSessionUserId } from '@/lib/auth';
import { userCategoryNames } from '@/lib/categories-server';
import {
  extractDebtsFromImages,
  extractDebtsFromText,
  extractInvoice,
  extractStatementFromText,
  MAX_DOCUMENT_CHARS,
} from '@/lib/import/ai-documents';
import { parseCsv } from '@/lib/import/csv';
import { toPromptImage } from '@/lib/import/images';
import { detectPdfKind } from '@/lib/import/detect';
import { looksLikeOfx, parseOfx } from '@/lib/import/ofx';
import {
  extractPdfLayoutText,
  PdfWithoutTextError,
  redactPersonalIds,
} from '@/lib/import/pdf-text';
import { decodeText } from '@/lib/import/statement';
import { looksLikeCardGuarantee, looksLikeTransfer, pairCreditPix } from '@/lib/import/transfers';
import { clientKeyFromRequest, createRateLimiter } from '@/lib/rate-limit';
import type { ImportPreview, InvoicePreview, StatementEntry } from '@/types/finance';

// Recebe o arquivo, devolve só a PRÉVIA tipada. Nada é gravado aqui: o usuário revisa na tela e
// confirma pelas Server Actions (importTransactions / replaceDebts), que validam tudo de novo.
// Fatura de cartão ('invoice') preenche o formulário de fatura e lista as compras para revisão;
// quem salva é o usuário.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 200;

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGES = 8;
const checkRateLimit = createRateLimiter({ limit: 10, windowMs: 60_000 });

// 'auto' vem do chat do Marx: quem envia não escolhe o tipo. Prints viram Serasa, OFX/CSV viram
// extrato e o PDF é reconhecido pelo cabeçalho. Fatura de cartão só pela tela do cartão.
const kindSchema = z.enum(['statement', 'scr', 'serasa', 'invoice', 'auto']);

const STATUS_BY_ERROR: Record<ExtractionErrorCode, number> = {
  not_configured: 503,
  invalid_output: 422,
  upstream_error: 502,
};

const fail = (error: string, status: number) => NextResponse.json({ ok: false, error }, { status });

export async function POST(request: Request) {
  // O proxy só confere a assinatura; aqui vale também a versão (senha trocada derruba a sessão).
  const userId = await getSessionUserId();
  if (!userId) return fail('Não autenticado.', 401);

  const rate = checkRateLimit(`${userId}:${clientKeyFromRequest(request)}`);
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Muitas importações seguidas. Aguarde um pouco e tente de novo.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail('Envie o arquivo como multipart/form-data.', 400);
  }

  const requested = kindSchema.safeParse(form.get('kind'));
  if (!requested.success) return fail('Tipo de importação inválido.', 400);
  const isAuto = requested.data === 'auto';
  const files = form.getAll('file').filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) return fail('Selecione um arquivo.', 400);
  if (files.some((f) => f.size > MAX_FILE_BYTES))
    return fail('Arquivo muito grande (máximo 5 MB).', 413);
  // Serasa e fatura aceitam prints (vários de uma vez); os outros, um arquivo só.
  const acceptsImages = isAuto || requested.data === 'serasa' || requested.data === 'invoice';
  if (files.length > 1 && !acceptsImages) return fail('Envie um arquivo por vez.', 400);
  let kind: Exclude<typeof requested.data, 'auto'> =
    requested.data === 'auto' ? 'serasa' : requested.data;
  if (files.length > MAX_IMAGES) return fail(`Envie no máximo ${MAX_IMAGES} prints por vez.`, 400);

  // Prints (uma ou mais imagens): a IA lê as imagens direto.
  if (acceptsImages) {
    const images = await Promise.all(
      files.map(async (f) => toPromptImage(new Uint8Array(await f.arrayBuffer()))),
    );
    if (images.every((img) => img !== null)) {
      const provider = resolveAiProvider(readCookie(request, AI_PROVIDER_COOKIE));
      if (!isAiProviderConfigured(provider)) {
        return fail(
          'A leitura de prints usa IA, e o provedor selecionado não está configurado no servidor.',
          503,
        );
      }
      const result =
        kind === 'invoice'
          ? await extractInvoice(provider, { images }, await userCategoryNames())
          : await extractDebtsFromImages(provider, images);
      if (!result.ok) return fail(result.error, STATUS_BY_ERROR[result.code]);
      return ok(result.preview);
    }
    if (files.length > 1)
      return fail('Para vários arquivos, envie só imagens (PNG, JPG ou WebP).', 415);
  }
  if (isAuto) kind = 'statement'; // não é imagem: OFX/CSV são extrato; o PDF é reconhecido abaixo

  const bytes = new Uint8Array(await files[0].arrayBuffer());
  const isPdf = new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';

  // Extrato em OFX/CSV: leitura local, sem IA.
  if (kind === 'statement' && !isPdf) {
    const text = decodeText(bytes);
    if (looksLikeOfx(text)) {
      const { entries, skipped } = parseOfx(text);
      return ok({
        kind: 'statement',
        format: 'ofx',
        entries: withTransfers(entries),
        warnings: skippedWarning(skipped),
      });
    }
    const csv = parseCsv(text);
    if (!csv.ok) return fail(csv.error, 422);
    return ok({
      kind: 'statement',
      format: 'csv',
      entries: withTransfers(csv.entries),
      warnings: skippedWarning(csv.skipped),
    });
  }

  if (!isPdf) {
    return fail(
      kind === 'serasa'
        ? 'Envie o PDF do Serasa ou prints da tela (PNG, JPG ou WebP).'
        : kind === 'invoice'
          ? 'Envie o PDF da fatura ou prints da tela (PNG, JPG ou WebP).'
          : 'O relatório do Registrato deve ser enviado em PDF.',
      415,
    );
  }

  const provider = resolveAiProvider(readCookie(request, AI_PROVIDER_COOKIE));
  if (!isAiProviderConfigured(provider)) {
    return fail(
      'A leitura de PDF usa IA, e o provedor selecionado não está configurado no servidor.',
      503,
    );
  }

  let layoutText: string;
  try {
    layoutText = redactPersonalIds(await extractPdfLayoutText(bytes));
  } catch (err) {
    if (err instanceof PdfWithoutTextError) {
      return fail(
        'Esse PDF não tem texto (parece escaneado). Baixe o PDF original no site do banco.',
        422,
      );
    }
    console.error('[import] pdf extraction failed', err);
    return fail(
      'Não consegui abrir esse PDF. Ele pode estar protegido por senha ou corrompido.',
      422,
    );
  }
  if (layoutText.length > MAX_DOCUMENT_CHARS) {
    return fail('Documento longo demais para ler de uma vez. Envie um período menor.', 413);
  }
  if (isAuto) kind = detectPdfKind(layoutText);

  const result =
    kind === 'statement'
      ? await extractStatementFromText(provider, layoutText, await userCategoryNames())
      : kind === 'invoice'
        ? await extractInvoice(provider, { layoutText }, await userCategoryNames())
        : await extractDebtsFromText(provider, kind, layoutText);
  if (!result.ok) return fail(result.error, STATUS_BY_ERROR[result.code]);
  return ok(result.preview);
}

function ok(data: ImportPreview | InvoicePreview) {
  return NextResponse.json({ ok: true, data }, { status: 200 });
}

/** Investimento, fatura e conta em dólar viram movimentação; Pix no crédito, compra no cartão (lib/import/transfers.ts). */
function withTransfers(entries: StatementEntry[]): StatementEntry[] {
  return pairCreditPix(
    entries.map((e) => ({
      ...e,
      isTransfer: looksLikeTransfer(e.description),
      fundsCard: looksLikeCardGuarantee(e.description),
    })),
  );
}

function skippedWarning(skipped: number): string[] {
  return skipped > 0
    ? [`${skipped} linha(s) ignorada(s): saldos, totais ou linhas sem data/valor.`]
    : [];
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of request.headers.get('cookie')?.split(';') ?? []) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=');
  }
  return undefined;
}

export async function GET() {
  return fail('Método não permitido. Use POST.', 405);
}
