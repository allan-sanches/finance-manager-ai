import 'server-only';

import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';

import {
  MercadoLivreError,
  mercadolivreConfigured,
  mercadolivreProduct,
  parseMercadoLivreUrl,
} from '@/lib/mercadolivre';
import { extractProductInfo, type ProductInfo } from '@/lib/product-page';

// O servidor abre links digitados pelo usuário: sem cuidado, um link para 127.0.0.1, 10.x ou o
// metadata da nuvem (169.254.169.254) leria a rede interna (SSRF). Por isso:
// - só http(s) nas portas padrão;
// - o IP é checado no momento da conexão (no lookup do socket), o que também barra DNS rebinding;
// - redirecionamentos são seguidos à mão, cada um passando pelas mesmas regras;
// - tempo e tamanho de resposta limitados.

const TIMEOUT_MS = 12_000;
const MAX_BYTES = 3 * 1024 * 1024;
const MAX_REDIRECTS = 4;

const BLOCKED = new net.BlockList();
for (const [net4, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 3],
] as const) {
  BLOCKED.addSubnet(net4, prefix, 'ipv4');
}
for (const [net6, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['64:ff9b::', 96],
] as const) {
  BLOCKED.addSubnet(net6, prefix, 'ipv6');
}

export function isPublicAddress(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  // ::ffff:10.0.0.1 é um IPv4 disfarçado.
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (mapped) return !BLOCKED.check(mapped, 'ipv4');
  return !BLOCKED.check(address, family === 4 ? 'ipv4' : 'ipv6');
}

export class ProductFetchError extends Error {}

function safeLookup(
  hostname: string,
  options: { all?: boolean },
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, '');
    const allowed = addresses.filter((a) => isPublicAddress(a.address));
    if (allowed.length === 0) {
      return callback(new ProductFetchError('Endereço não permitido.') as NodeJS.ErrnoException, '');
    }
    if (options.all) return callback(null, allowed);
    callback(null, allowed[0].address, allowed[0].family);
  });
}

export function assertFetchableUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProductFetchError('Link inválido.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ProductFetchError('Link precisa ser http ou https.');
  if (url.port && url.port !== '80' && url.port !== '443') throw new ProductFetchError('Porta não permitida.');
  if (url.username || url.password) throw new ProductFetchError('Link com usuário e senha não é aceito.');
  // IP literal não passa pelo lookup: checa aqui.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isPublicAddress(host)) throw new ProductFetchError('Endereço não permitido.');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new ProductFetchError('Endereço não permitido.');
  }
  return url;
}

type Page = { url: string; html: string };

function requestOnce(url: URL): Promise<{ status: number; location?: string; body: string }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(
      url,
      {
        method: 'GET',
        lookup: safeLookup as unknown as typeof dnsLookup,
        timeout: TIMEOUT_MS,
        headers: {
          // Várias lojas devolvem página vazia ou 403 para user-agents que não parecem navegador.
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'pt-BR,pt;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: res.headers.location, body: '' });
        }
        const type = String(res.headers['content-type'] ?? '');
        if (type && !/html|xml/i.test(type)) {
          res.resume();
          return reject(new ProductFetchError('O link não é uma página.'));
        }
        const encoding = String(res.headers['content-encoding'] ?? '').toLowerCase();
        const stream =
          encoding === 'gzip'
            ? res.pipe(zlib.createGunzip())
            : encoding === 'deflate'
              ? res.pipe(zlib.createInflate())
              : encoding === 'br'
                ? res.pipe(zlib.createBrotliDecompress())
                : res;
        const chunks: Buffer[] = [];
        let size = 0;
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_BYTES) {
            req.destroy();
            // Página enorme: o que já chegou costuma ter o <head> com os dados do produto.
            resolve({ status, body: Buffer.concat(chunks).toString('utf8') });
            return;
          }
          chunks.push(chunk);
        });
        stream.on('end', () => resolve({ status, body: Buffer.concat(chunks).toString('utf8') }));
        stream.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new ProductFetchError('A loja demorou demais para responder.')));
    req.on('error', reject);
    req.end();
  });
}

async function fetchPage(raw: string): Promise<Page> {
  let url = assertFetchableUrl(raw);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await requestOnce(url);
    if (res.location) {
      url = assertFetchableUrl(new URL(res.location, url).href);
      continue;
    }
    if (res.status === 403 || res.status === 429 || res.status === 503) {
      throw new ProductFetchError('A loja bloqueou a consulta automática.');
    }
    if (res.status < 200 || res.status >= 300) throw new ProductFetchError(`A loja respondeu ${res.status}.`);
    return { url: url.href, html: res.body };
  }
  throw new ProductFetchError('Redirecionamentos demais.');
}

/** Abre a página do produto e lê nome, preço e foto. Lança ProductFetchError com mensagem para a tela. */
export async function fetchProductInfo(rawUrl: string): Promise<ProductInfo> {
  // Mercado Livre bloqueia a leitura da página: vai pela API oficial.
  const ml = parseMercadoLivreUrl(rawUrl);
  if (ml) {
    if (!mercadolivreConfigured()) {
      throw new ProductFetchError(
        'Para ler preços do Mercado Livre, configure MERCADOLIVRE_CLIENT_ID e MERCADOLIVRE_CLIENT_SECRET no servidor.',
      );
    }
    try {
      return await mercadolivreProduct(ml);
    } catch (err) {
      if (err instanceof MercadoLivreError) throw new ProductFetchError(err.message);
      throw new ProductFetchError('Não foi possível consultar o Mercado Livre.');
    }
  }
  if (/(^|\.)mercadoli(vre|bre)\./i.test(safeHostname(rawUrl))) {
    throw new ProductFetchError(
      'Esse link do Mercado Livre não tem o código do produto. Use o link do produto de catálogo (com /p/MLB…).',
    );
  }
  try {
    const page = await fetchPage(rawUrl);
    return extractProductInfo(page.html, page.url);
  } catch (err) {
    if (err instanceof ProductFetchError) throw err;
    throw new ProductFetchError('Não foi possível abrir a página da loja.');
  }
}

function safeHostname(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return '';
  }
}
