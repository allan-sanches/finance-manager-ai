import { ImportPanel } from '@/components/ImportPanel';

export default function ImportarPage() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold md:text-3xl">Importar arquivos</h1>
        <p className="text-base-content/60 text-sm">
          Envie extratos do banco ou os relatórios do Registrato e do Serasa. Nada é salvo antes
          de você revisar.
        </p>
      </header>

      <ImportPanel />

      <details className="collapse-arrow bg-base-200 collapse">
        <summary className="collapse-title font-medium">Onde baixar cada arquivo</summary>
        <div className="collapse-content text-base-content/70 space-y-2 text-sm">
          <p>
            <strong>Extrato bancário:</strong> no app ou internet banking, procure por
            &quot;Exportar extrato&quot;. Prefira <strong>OFX</strong> (lido sem IA, mais
            confiável); CSV também é lido sem IA. PDF é lido pela IA.
          </p>
          <p>
            <strong>Registrato (SCR):</strong> em registrato.bcb.gov.br, entre com a conta gov.br
            e baixe o &quot;Relatório de Empréstimos e Financiamentos&quot; em PDF.
          </p>
          <p>
            <strong>Serasa:</strong> no app ou site do Serasa, exporte em PDF a lista de dívidas
            pendentes (ou o relatório pedido pelo canal de privacidade/LGPD).
          </p>
          <p>
            Nos PDFs, nome e CPF são removidos do texto antes de qualquer envio à IA.
          </p>
        </div>
      </details>
    </div>
  );
}
