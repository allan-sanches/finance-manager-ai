import { describe, expect, it } from 'vitest';

import { parseMercadoLivreUrl } from '@/lib/mercadolivre';

describe('parseMercadoLivreUrl', () => {
  it('produto de catálogo', () => {
    expect(parseMercadoLivreUrl('https://www.mercadolivre.com.br/apple-iphone-15-128-gb-preto/p/MLB1027172669')).toEqual({
      productId: 'MLB1027172669',
      itemId: null,
    });
  });

  it('anúncio clicado no catálogo (wid, inclusive no fragmento)', () => {
    expect(parseMercadoLivreUrl('https://www.mercadolivre.com.br/x/p/MLB123#wid=MLB4455667788&sid=x')).toEqual({
      productId: 'MLB123',
      itemId: 'MLB4455667788',
    });
  });

  it('anúncio avulso no endereço antigo', () => {
    expect(parseMercadoLivreUrl('https://produto.mercadolivre.com.br/MLB-3456789012-fone-_JM')).toEqual({
      productId: null,
      itemId: 'MLB3456789012',
    });
  });

  it('link /up/ sem wid e links de outras lojas não são consultáveis', () => {
    expect(parseMercadoLivreUrl('https://www.mercadolivre.com.br/fone/up/MLBU123456')).toBeNull();
    expect(parseMercadoLivreUrl('https://www.kabum.com.br/produto/112948')).toBeNull();
  });
});
