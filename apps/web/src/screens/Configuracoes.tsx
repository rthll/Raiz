import { Button, Card, CardKicker, CardMeta, Segmented } from '@raiz/ui';
import { useState } from 'react';
import { useAuth, usePreferencias } from '../auth/AuthProvider.js';
import { TelaHeader } from '../shell/TelaHeader.js';
import { useAvisos } from '../ui/Toaster.js';

type Chave = 'modoCasal' | 'modoPrivacidade' | 'alertasVencimento';

/**
 * As três preferências existiam no modelo desde o começo e eram alteráveis pela
 * API, mas nenhuma tela as alcançava — o handoff não tinha screenshot de
 * configurações, então ela ficou de fora das dez. Na prática elas nasciam
 * ligadas e ficavam ligadas, o que deixava uma casa de uma pessoa só com a
 * divisão de um casal que não existe.
 */
const PREFERENCIAS: ReadonlyArray<{ chave: Chave; titulo: string; descricao: string }> = [
  {
    chave: 'modoCasal',
    titulo: 'Modo casal',
    descricao:
      'Mostra o responsável por cada lançamento e o acerto de contas entre as pessoas da casa. Desligue se a casa é de uma pessoa só.',
  },
  {
    chave: 'modoPrivacidade',
    titulo: 'Modo privacidade',
    descricao:
      'Troca todo valor em dinheiro por um marcador na tela, para consultar o sistema em público sem expor números.',
  },
  {
    chave: 'alertasVencimento',
    titulo: 'Alertas de vencimento',
    descricao:
      'Mostra o aviso do topo quando um teste grátis está para acabar ou uma fatura está por fechar.',
  },
];

const LIGADO_DESLIGADO = [
  { valor: 'ligado', rotulo: 'Ligado' },
  { valor: 'desligado', rotulo: 'Desligado' },
] as const;

type Estado = (typeof LIGADO_DESLIGADO)[number]['valor'];

export function Configuracoes() {
  const { usuario, sair, atualizarPreferencias } = useAuth();
  const preferencias = usePreferencias();
  const { mostrar } = useAvisos();
  const [salvando, setSalvando] = useState<Chave | null>(null);

  /**
   * Salva na hora, sem botão de confirmar: são três interruptores cujo efeito
   * aparece na própria tela seguinte. Um formulário com "Salvar" só adicionaria
   * um passo e a chance de sair sem salvar.
   */
  async function alternar(chave: Chave, estado: Estado) {
    setSalvando(chave);
    try {
      await atualizarPreferencias({ [chave]: estado === 'ligado' });
      mostrar('Preferência salva.');
    } catch {
      mostrar('Não foi possível salvar a preferência.', 'erro');
    } finally {
      setSalvando(null);
    }
  }

  return (
    <>
      <TelaHeader semMes />

      <div className="raiz-grid raiz-grid-panel">
        <Card>
          <CardKicker>Conta</CardKicker>
          <h3 style={{ margin: 0, fontSize: 17 }}>{usuario?.nome}</h3>
          <CardMeta>{usuario?.email}</CardMeta>
          <div style={{ marginTop: 'var(--space-2)' }}>
            <Button variant="secondary" onClick={() => void sair()}>
              Sair da conta
            </Button>
          </div>
        </Card>

        <Card style={{ gridColumn: '1 / -1' }}>
          <CardKicker>Preferências</CardKicker>
          <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-2)' }}>
            {PREFERENCIAS.map(({ chave, titulo, descricao }) => (
              <div
                key={chave}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                }}
              >
                <div style={{ flex: '1 1 260px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{titulo}</div>
                  <div className="card-meta" style={{ marginTop: 2 }}>
                    {descricao}
                  </div>
                </div>
                <div style={{ opacity: salvando === chave ? 0.6 : 1 }}>
                  <Segmented
                    aria={titulo}
                    opcoes={LIGADO_DESLIGADO}
                    valor={preferencias[chave] ? 'ligado' : 'desligado'}
                    onChange={(estado) => void alternar(chave, estado)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
