/**
 * Testes dos componentes do design system.
 *
 * O foco é comportamento que o CSS não garante e que quebra em silêncio:
 * foco preso no diálogo, mascaramento do modo privacidade, navegação por
 * teclado no controle segmentado, semântica para leitor de tela.
 *
 * Fidelidade visual não se testa aqui — isso é conferido contra os screenshots.
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { Button } from './Button.js';
import { Dialog } from './Dialog.js';
import { Segmented } from './Segmented.js';
import { Table } from './Table.js';
import { Bar, Donut, Dot } from './data.js';
import { Kpi } from './Kpi.js';
import { MonthPicker, deslocarCompetencia, rotuloCompetencia } from './MonthPicker.js';
import { ConfirmDialog, EmptyState, ErrorState } from './states.js';
import { Money, PrivacyProvider } from '../format/privacy.js';

afterEach(cleanup);

describe('Button', () => {
  it('usa type="button" por padrão para não submeter formulário sem querer', () => {
    render(<Button>Editar</Button>);
    expect(screen.getByRole('button', { name: 'Editar' })).toHaveAttribute('type', 'button');
  });

  it('respeita type explícito', () => {
    render(<Button type="submit">Salvar</Button>);
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'submit');
  });

  it('compõe as classes do Organic', () => {
    render(<Button variant="primary">Novo</Button>);
    const botao = screen.getByRole('button');
    expect(botao).toHaveClass('btn', 'btn-primary');
  });

  it('não dispara quando desabilitado', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('modo privacidade', () => {
  it('mostra o valor quando desligado', () => {
    render(
      <PrivacyProvider ativo={false}>
        <Money valor={21881.25} />
      </PrivacyProvider>,
    );
    expect(screen.getByText('R$ 21.881,25')).toBeInTheDocument();
  });

  it('mascara o valor quando ligado', () => {
    render(
      <PrivacyProvider ativo>
        <Money valor={21881.25} />
      </PrivacyProvider>,
    );
    expect(screen.queryByText(/21\.881/)).not.toBeInTheDocument();
    expect(screen.getByText(/••••/)).toBeInTheDocument();
  });

  it('mascara também dentro do KPI, sem a tela precisar saber disso', () => {
    render(
      <PrivacyProvider ativo>
        <Kpi rotulo="Saldo em contas" valor={21881.25} />
      </PrivacyProvider>,
    );
    expect(screen.getByText('Saldo em contas')).toBeInTheDocument();
    expect(screen.queryByText(/21\.881/)).not.toBeInTheDocument();
  });

  it('assina entradas e saídas', () => {
    render(
      <PrivacyProvider ativo={false}>
        <Money valor={7400} sinal="ENTRADA" />
        <Money valor={2200} sinal="SAIDA" />
      </PrivacyProvider>,
    );
    expect(screen.getByText(/^\+ R\$ 7\.400,00$/)).toBeInTheDocument();
    expect(screen.getByText(/^– R\$ 2\.200,00$/)).toBeInTheDocument();
  });
});

describe('Segmented', () => {
  function Exemplo() {
    const [valor, setValor] = useState<'todos' | 'ENTRADA' | 'SAIDA'>('todos');
    return (
      <>
        <Segmented
          aria="Filtrar por tipo"
          valor={valor}
          onChange={setValor}
          opcoes={[
            { valor: 'todos', rotulo: 'Todos' },
            { valor: 'ENTRADA', rotulo: 'Entradas' },
            { valor: 'SAIDA', rotulo: 'Saídas' },
          ]}
        />
        <span data-testid="atual">{valor}</span>
      </>
    );
  }

  it('expõe um radiogroup com as opções nomeadas', () => {
    render(<Exemplo />);
    const grupo = screen.getByRole('radiogroup', { name: 'Filtrar por tipo' });
    expect(within(grupo).getAllByRole('radio')).toHaveLength(3);
  });

  it('marca a opção selecionada', () => {
    render(<Exemplo />);
    expect(screen.getByRole('radio', { name: 'Todos' })).toBeChecked();
  });

  it('troca ao clicar', async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole('radio', { name: 'Saídas' }));
    expect(screen.getByTestId('atual')).toHaveTextContent('SAIDA');
  });

  it('navega com as setas do teclado — vantagem de usar radio de verdade', async () => {
    render(<Exemplo />);
    await userEvent.click(screen.getByRole('radio', { name: 'Todos' }));
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByTestId('atual')).toHaveTextContent('ENTRADA');
  });
});

describe('Dialog', () => {
  function Exemplo({ onFechar = vi.fn() }: { onFechar?: () => void }) {
    return (
      <Dialog aberto titulo="Novo lançamento" onFechar={onFechar}>
        <input aria-label="Descrição" />
        <input aria-label="Valor" />
      </Dialog>
    );
  }

  it('anuncia-se como diálogo modal com o título ligado', () => {
    render(<Exemplo />);
    const dialogo = screen.getByRole('dialog');
    expect(dialogo).toHaveAttribute('aria-modal', 'true');
    expect(dialogo).toHaveAccessibleName('Novo lançamento');
  });

  it('não renderiza nada quando fechado', () => {
    render(
      <Dialog aberto={false} titulo="Oculto" onFechar={vi.fn()}>
        <p>conteúdo</p>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('leva o foco para o primeiro campo ao abrir', () => {
    render(<Exemplo />);
    expect(screen.getByLabelText('Descrição')).toHaveFocus();
  });

  it('prende o foco: Tab no último volta para o primeiro', async () => {
    render(<Exemplo />);
    await userEvent.tab(); // Descrição -> Valor
    expect(screen.getByLabelText('Valor')).toHaveFocus();
    await userEvent.tab(); // Valor -> volta para Descrição
    expect(screen.getByLabelText('Descrição')).toHaveFocus();
  });

  it('prende o foco também para trás, com Shift+Tab', async () => {
    render(<Exemplo />);
    await userEvent.tab({ shift: true });
    expect(screen.getByLabelText('Valor')).toHaveFocus();
  });

  it('fecha no Esc', async () => {
    const onFechar = vi.fn();
    render(<Exemplo onFechar={onFechar} />);
    await userEvent.keyboard('{Escape}');
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('trava a rolagem do corpo enquanto aberto e devolve ao fechar', () => {
    const { unmount } = render(<Exemplo />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('devolve o foco para quem abriu', async () => {
    function Abridor() {
      const [aberto, setAberto] = useState(false);
      return (
        <>
          <Button onClick={() => setAberto(true)}>Abrir</Button>
          <Dialog aberto={aberto} titulo="Modal" onFechar={() => setAberto(false)}>
            <input aria-label="Campo" />
          </Dialog>
        </>
      );
    }
    render(<Abridor />);
    const abrir = screen.getByRole('button', { name: 'Abrir' });
    await userEvent.click(abrir);
    expect(screen.getByLabelText('Campo')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(abrir).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('deixa o foco em Cancelar, para Enter não excluir por acidente', () => {
    render(
      <ConfirmDialog
        aberto
        titulo="Excluir lançamento?"
        descricao="Não dá para desfazer."
        rotuloConfirmar="Excluir"
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });

  it('nomeia a ação destrutiva de forma explícita', () => {
    render(
      <ConfirmDialog
        aberto
        titulo="Excluir cartão?"
        descricao="x"
        rotuloConfirmar="Excluir cartão"
        onConfirmar={vi.fn()}
        onCancelar={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Excluir cartão' })).toBeInTheDocument();
  });
});

describe('MonthPicker', () => {
  it('traduz a competência para português', () => {
    expect(rotuloCompetencia('2026-08')).toBe('Agosto 2026');
    expect(rotuloCompetencia('2026-12')).toBe('Dezembro 2026');
  });

  it('vira o ano corretamente ao deslocar', () => {
    expect(deslocarCompetencia('2026-12', 1)).toBe('2027-01');
    expect(deslocarCompetencia('2026-01', -1)).toBe('2025-12');
    expect(deslocarCompetencia('2026-08', -8)).toBe('2025-12');
  });

  it('navega entre os meses', async () => {
    function Exemplo() {
      const [mes, setMes] = useState('2026-08');
      return (
        <>
          <MonthPicker valor={mes} onChange={setMes} />
          <span data-testid="mes">{mes}</span>
        </>
      );
    }
    render(<Exemplo />);
    await userEvent.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByTestId('mes')).toHaveTextContent('2026-09');
    await userEvent.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(screen.getByTestId('mes')).toHaveTextContent('2026-08');
  });

  it('desabilita as setas nos limites do intervalo carregado', () => {
    render(<MonthPicker valor="2026-03" onChange={vi.fn()} minimo="2026-03" maximo="2026-10" />);
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeEnabled();
  });
});

describe('Bar', () => {
  it('vira progressbar acessível quando recebe descrição', () => {
    render(<Bar pct={63} cor="#d67f48" aria="63% do orçamento de Alimentação" />);
    const barra = screen.getByRole('progressbar');
    expect(barra).toHaveAttribute('aria-valuenow', '63');
    expect(barra).toHaveAccessibleName('63% do orçamento de Alimentação');
  });

  it('não anuncia nada quando é puramente decorativa', () => {
    render(<Bar pct={40} cor="#d67f48" />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('arredonda o valor anunciado mesmo com percentual quebrado', () => {
    render(<Bar pct={182.688} cor="#b2622d" estourou aria="Moradia" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '183');
  });
});

describe('Donut', () => {
  it('não quebra com carteira vazia', () => {
    const { container } = render(<Donut fatias={[]} />);
    expect(container.firstChild).toBeTruthy();
  });

  it('monta um conic-gradient com as fatias', () => {
    const { container } = render(
      <Donut
        fatias={[
          { classe: 'Renda fixa', valor: 60500 },
          { classe: 'Cripto', valor: 9400 },
        ]}
      />,
    );
    const estilo = (container.firstChild as HTMLElement).getAttribute('style') ?? '';
    expect(estilo).toContain('conic-gradient');
  });
});

describe('Dot', () => {
  it('é decorativo e fica fora da árvore de acessibilidade', () => {
    const { container } = render(<Dot cor="#d67f48" />);
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Table', () => {
  it('rola dentro da própria caixa e é alcançável por teclado', () => {
    render(
      <Table aria="Lançamentos">
        <tbody>
          <tr>
            <td>Aluguel</td>
          </tr>
        </tbody>
      </Table>,
    );
    const regiao = screen.getByRole('region', { name: 'Lançamentos' });
    expect(regiao).toHaveAttribute('tabindex', '0');
    expect(regiao.style.overflowX).toBe('auto');
  });
});

describe('estados', () => {
  it('o estado vazio oferece uma saída', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        titulo="Nenhum lançamento em agosto"
        descricao="Importe um extrato para começar."
        acao={<Button onClick={onClick}>Novo lançamento</Button>}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Novo lançamento' }));
    expect(onClick).toHaveBeenCalled();
  });

  it('o erro é anunciado como alerta e permite tentar de novo', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onTentarNovamente={onRetry} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
