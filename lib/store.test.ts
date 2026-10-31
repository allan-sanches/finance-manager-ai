import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_SETTINGS } from '@/lib/finance';
import type { FinanceSnapshot } from '@/types/finance';

// As Server Actions viram mocks: o teste olha só o que o store manda e o que faz com a resposta.
const snapshot = (): FinanceSnapshot => ({
  transactions: [],
  creditCards: [],
  creditCardInvoices: [],
  savingsGoals: [],
  shoppingItems: [],
  debts: [],
  categories: [],
  settings: DEFAULT_SETTINGS,
});

vi.mock('@/app/actions/finance', () => ({
  addShoppingItem: vi.fn(async () => snapshot()),
  loadSnapshot: vi.fn(async () => snapshot()),
}));

const actions = await import('@/app/actions/finance');
const { useFinanceStore } = await import('@/lib/store');

const draft = { name: 'Arroz', listType: 'household' as const };
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  vi.mocked(actions.addShoppingItem).mockReset().mockImplementation(async () => snapshot());
  useFinanceStore.getState().reset();
});

describe('store: dados de cada usuário', () => {
  it('toda alteração vai com o id do usuário que a aba carregou', async () => {
    useFinanceStore.getState().hydrate(snapshot(), 'u1');
    useFinanceStore.getState().addShoppingItem(draft);
    await flush();
    expect(actions.addShoppingItem).toHaveBeenCalledWith('u1', expect.objectContaining({ name: 'Arroz' }));
  });

  it('sem dados carregados (logout) nada é enviado', async () => {
    useFinanceStore.getState().addShoppingItem(draft);
    await flush();
    expect(actions.addShoppingItem).not.toHaveBeenCalled();
  });

  it('logout apaga a memória e descarta a fila da conta anterior', async () => {
    let release: () => void = () => {};
    vi.mocked(actions.addShoppingItem).mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve(snapshot()))),
    );
    const store = useFinanceStore.getState();
    store.hydrate(snapshot(), 'u1');
    store.addShoppingItem(draft); // em voo
    store.addShoppingItem({ ...draft, name: 'Feijão' }); // ainda na fila
    await flush();

    useFinanceStore.getState().reset();
    expect(useFinanceStore.getState().shoppingItems).toEqual([]);

    useFinanceStore.getState().hydrate(snapshot(), 'u2');
    release();
    await flush();
    expect(actions.addShoppingItem).toHaveBeenCalledTimes(1); // o "Feijão" de u1 não foi enviado
    expect(useFinanceStore.getState().sessionUserId).toBe('u2');
  });

  it('se o servidor diz que a sessão mudou, recarrega a tela em vez de aplicar a resposta', async () => {
    const reload = vi.fn();
    vi.stubGlobal('window', { location: { reload } });
    vi.mocked(actions.addShoppingItem).mockResolvedValueOnce({ sessionChanged: true });
    useFinanceStore.getState().hydrate(snapshot(), 'u1');
    useFinanceStore.getState().addShoppingItem(draft);
    await flush();
    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
