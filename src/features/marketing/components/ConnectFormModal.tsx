import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/feedback/Toast'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { leadEndpoint } from '../api'
import type { LandingPage } from '../types'

/** Formulário HTML pronto para colar na landing page (repassa os parâmetros UTM do anúncio). */
function formSnippet(endpoint: string, token: string) {
  return `<form action="${endpoint}" method="POST">
  <input type="hidden" name="token" value="${token}">
  <!-- Página de obrigado exibida depois do envio -->
  <input type="hidden" name="redirect" value="https://SEU-SITE/obrigado">

  <input name="nome" required placeholder="Seu nome">
  <input name="telefone" required inputmode="tel" placeholder="WhatsApp com DDD">
  <input name="email" type="email" placeholder="E-mail (opcional)">
  <textarea name="mensagem" placeholder="Mensagem (opcional)"></textarea>

  <!-- Proteção contra robôs: não remova e deixe escondido -->
  <input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">

  <button type="submit">Quero ser atendido</button>
</form>
<script>
  // Envia ao CRM os parâmetros utm_ do anúncio que trouxe o visitante.
  (function () {
    var form = document.currentScript.previousElementSibling;
    new URLSearchParams(location.search).forEach(function (value, key) {
      if (key.indexOf('utm_') !== 0) return;
      var input = document.createElement('input');
      input.type = 'hidden'; input.name = key; input.value = value;
      form.appendChild(input);
    });
  })();
</script>`
}

function CopyBlock({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar', 'Selecione o texto e copie manualmente.')
    }
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink">{label}</p>
        <Button size="sm" variant="ghost" icon={copied ? <Check /> : <Copy />} onClick={() => void copy()}>
          {copied ? 'Copiado' : 'Copiar'}
        </Button>
      </div>
      {multiline ? (
        <pre className="max-h-64 overflow-auto rounded-md border border-line bg-canvas p-3 text-[11.5px] leading-relaxed text-ink">{value}</pre>
      ) : (
        <code className="block overflow-x-auto rounded-md border border-line bg-canvas px-3 py-2 text-xs whitespace-nowrap text-ink">{value}</code>
      )}
    </div>
  )
}

export function ConnectFormModal({ page, onClose }: { page: LandingPage | null; onClose: () => void }) {
  if (!page) return null
  const endpoint = leadEndpoint()
  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title="Conectar o formulário"
      description={`Faça o formulário da landing page "${page.name}" enviar os leads para o CRM.`}
      footer={<Button onClick={onClose}>Fechar</Button>}
    >
      <div className="space-y-5 text-[13px] leading-relaxed text-muted">
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>Copie o formulário abaixo e cole no editor da landing page (bloco de HTML personalizado).</li>
          <li>
            Troque <code className="text-ink">https://SEU-SITE/obrigado</code> pelo endereço da sua página de agradecimento.
          </li>
          <li>Publique a página e faça um envio de teste: o lead aparece em Leads, com origem “Landing page”.</li>
        </ol>
        <CopyBlock label="Formulário pronto (HTML)" value={formSnippet(endpoint, page.token)} multiline />
        <div className="grid gap-4 sm:grid-cols-2">
          <CopyBlock label="Endereço de envio (POST)" value={endpoint} />
          <CopyBlock label="Identificador da página (token)" value={page.token} />
        </div>
        <p className="text-xs">
          Usa outra ferramenta (Elementor, RD Station, webhook…)? Envie para o endereço acima os campos{' '}
          <code className="text-ink">token</code>, <code className="text-ink">nome</code>, <code className="text-ink">telefone</code> e, se quiser,{' '}
          <code className="text-ink">email</code>, <code className="text-ink">mensagem</code> e os parâmetros <code className="text-ink">utm_*</code>, em JSON ou formulário.
          Quando o <code className="text-ink">utm_campaign</code> for igual ao identificador de uma campanha, o lead é ligado a ela.
        </p>
      </div>
    </Modal>
  )
}
