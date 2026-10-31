import { describe, expect, it } from 'vitest';

import { extractProductInfo, parsePrice } from '@/lib/product-page';

describe('parsePrice', () => {
  it.each([
    ['1.299,90', 1299.9],
    ['R$ 1.299', 1299],
    ['1299.90', 1299.9],
    ['1,299.90', 1299.9],
    ['49,9', 49.9],
    [349, 349],
  ])('%s → %s', (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });

  it('recusa o que não é preço', () => {
    expect(parsePrice('Em estoque')).toBeNull();
    expect(parsePrice(0)).toBeNull();
    expect(parsePrice(null)).toBeNull();
  });
});

describe('extractProductInfo', () => {
  const url = 'https://loja.example/produto/fone';

  it('lê Product do JSON-LD, inclusive dentro de @graph e com várias ofertas', () => {
    const html = `<html><head>
      <script type="application/ld+json">{"@context":"https://schema.org","@graph":[
        {"@type":"BreadcrumbList"},
        {"@type":"Product","name":"Fone XYZ","image":["/img/fone.jpg"],
         "offers":{"@type":"AggregateOffer","lowPrice":"499.90","offers":[{"price":"529.90","priceCurrency":"BRL"},{"price":"499.90","priceCurrency":"BRL"}]}}
      ]}</script></head></html>`;
    expect(extractProductInfo(html, url)).toEqual({
      name: 'Fone XYZ',
      price: 499.9,
      imageUrl: 'https://loja.example/img/fone.jpg',
    });
  });

  it('ignora oferta em outra moeda', () => {
    const html = `<script type="application/ld+json">{"@type":"Product","name":"X","offers":{"price":"99","priceCurrency":"USD"}}</script>`;
    expect(extractProductInfo(html, url).price).toBeNull();
  });

  it('sem JSON-LD usa as meta tags de produto e o og:title', () => {
    const html = `<head>
      <meta property="og:title" content="Cadeira &amp; Mesa" />
      <meta property="product:price:amount" content="1.299,00">
      <meta property="og:image" content="http://cdn.loja.example/c.jpg">
    </head>`;
    expect(extractProductInfo(html, url)).toEqual({
      name: 'Cadeira & Mesa',
      price: 1299,
      imageUrl: 'https://cdn.loja.example/c.jpg',
    });
  });

  it('usa itemprop="price" como último recurso', () => {
    const html = `<title>Produto</title><span itemprop="price" content="89.90">R$ 89,90</span>`;
    expect(extractProductInfo(html, url)).toMatchObject({ name: 'Produto', price: 89.9 });
  });

  it('não aceita imagem com esquema estranho', () => {
    const html = `<meta property="og:image" content="javascript:alert(1)">`;
    expect(extractProductInfo(html, url).imageUrl).toBeNull();
  });
});
