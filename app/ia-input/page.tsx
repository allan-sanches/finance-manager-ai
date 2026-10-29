import { IaInputForm } from '@/components/IaInputForm';

export default function IaInputPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">Entrada por IA</h1>
        <p className="text-base-content/60 text-sm">
          Descreva o gasto ou receita em linguagem natural. A IA extrai os dados estruturados
          para você revisar antes de salvar.
        </p>
      </header>

      <IaInputForm />

      <details className="collapse-arrow bg-base-200 collapse">
        <summary className="collapse-title font-medium">Exemplos de frases</summary>
        <div className="collapse-content text-base-content/70 text-sm">
          <ul className="ml-6 list-disc space-y-1">
            <li>Gastei 45 reais no iFood ontem à noite no crédito</li>
            <li>Recebi 3200 de salário hoje via Pix</li>
            <li>Paguei 89,90 na conta de luz no débito automático todo mês</li>
            <li>Comprei um livro por R$ 72 na Amazon no cartão de crédito</li>
          </ul>
        </div>
      </details>
    </div>
  );
}
