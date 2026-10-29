import { IaInputForm } from '@/components/IaInputForm';
import { PageHeader } from '@/components/ui';

export default function IaInputPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Entrada por IA"
        subtitle="Escreva o gasto ou receita do seu jeito. A IA preenche, você revisa."
      />

      <IaInputForm />

      <details className="collapse-arrow panel collapse">
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
