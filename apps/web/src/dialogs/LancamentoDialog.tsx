import { Field, Input, Select } from '@raiz/ui';
import { lancamentoSchema } from '@raiz/schemas';
import { useEffect } from 'react';
import { useCartoes, useCategorias, useContas, useSalvar } from '../api/hooks.js';
import type { Lancamento } from '../api/types.js';
import { useFormulario } from '../forms/useFormulario.js';
import { useAvisos } from '../ui/Toaster.js';
import { DialogoFormulario } from './DialogoFormulario.js';

export interface LancamentoDialogProps {
  aberto: boolean;
  /** Presente ao editar; ausente ao criar. */
  editando?: Lancamento | null;
  /** Data padrão do novo lançamento, dentro da competência aberta. */
  dataPadrao: string;
  onFechar: () => void;
}

/** `origem` é um valor só no `<select>`: `conta:<id>` ou `cartao:<id>`. */
const origemDe = (l: Lancamento | null | undefined) =>
  l?.cardId ? `cartao:${l.cardId}` : l?.accountId ? `conta:${l.accountId}` : '';

export function LancamentoDialog({
  aberto,
  editando,
  dataPadrao,
  onFechar,
}: LancamentoDialogProps) {
  const categorias = useCategorias();
  const contas = useContas();
  const cartoes = useCartoes();
  const salvar = useSalvar<Lancamento>('transactions');
  const { mostrar } = useAvisos();

  const formulario = useFormulario(lancamentoSchema, {});

  // Recarrega os valores toda vez que abre — inclusive ao trocar de item editado.
  useEffect(() => {
    if (!aberto) return;
    formulario.reiniciar({
      descricao: editando?.descricao ?? '',
      valor: editando ? String(editando.valor).replace('.', ',') : '',
      data: editando?.data ?? dataPadrao,
      tipo: editando?.tipo ?? 'SAIDA',
      categoriaId: editando?.categoriaId ?? '',
      origem: origemDe(editando),
      accountId: editando?.accountId ?? null,
      cardId: editando?.cardId ?? null,
      responsavel: editando?.responsavel ?? 'CONJUNTA',
      parcelaAtual: editando?.parcelaAtual ?? '',
      parcelaTotal: editando?.parcelaTotal ?? '',
    });
    // `formulario` muda a cada render; depender dele reiniciaria em loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando, dataPadrao]);

  const origem = String(formulario.valores.origem ?? '');

  /**
   * A tela tem um campo só ("Conta ou cartão"); o schema tem dois. A tradução
   * acontece na hora da escolha, não no envio — assim a validação do schema roda
   * sobre os mesmos campos que a API vai receber, e a regra "conta OU cartão"
   * é conferida de verdade antes de enviar.
   */
  const escolherOrigem = (valor: string) => {
    const [tipo, id] = valor.split(':');
    formulario.definir('origem', valor);
    formulario.definir('accountId', tipo === 'conta' ? id : null);
    formulario.definir('cardId', tipo === 'cartao' ? id : null);
  };

  const onSalvar = formulario.enviar(async (dados) => {
    await salvar.mutateAsync({
      id: editando?.id,
      dados: {
        ...(dados as object),
        // Campos vazios viram null, não string vazia.
        parcelaAtual: formulario.valores.parcelaAtual || null,
        parcelaTotal: formulario.valores.parcelaTotal || null,
      },
    });
    mostrar(editando ? 'Lançamento atualizado.' : 'Lançamento criado.');
    onFechar();
  });

  // O schema aponta o erro de origem em `accountId`; o campo na tela é `origem`.
  const erroOrigem = formulario.erros.origem ?? formulario.erros.accountId;

  return (
    <DialogoFormulario
      aberto={aberto}
      titulo={editando ? 'Editar lançamento' : 'Novo lançamento'}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Salvar'}
      formulario={formulario}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <Field label="Descrição" largo erro={formulario.erros.descricao}>
        {(p) => <Input {...p} {...formulario.campo('descricao')} autoFocus />}
      </Field>

      <Field label="Valor" erro={formulario.erros.valor} dica="Aceita 1.234,56">
        {(p) => (
          <Input {...p} {...formulario.campo('valor')} inputMode="decimal" placeholder="0,00" />
        )}
      </Field>

      <Field label="Data" erro={formulario.erros.data}>
        {(p) => <Input {...p} {...formulario.campo('data')} type="date" />}
      </Field>

      <Field label="Tipo" erro={formulario.erros.tipo}>
        {(p) => (
          <Select {...p} {...formulario.campo('tipo')}>
            <option value="SAIDA">Saída</option>
            <option value="ENTRADA">Entrada</option>
          </Select>
        )}
      </Field>

      <Field label="Categoria" erro={formulario.erros.categoriaId}>
        {(p) => (
          <Select {...p} {...formulario.campo('categoriaId')}>
            <option value="">Selecione…</option>
            {categorias.data
              // Só faz sentido oferecer categorias do mesmo tipo do lançamento.
              ?.filter((c) => c.tipo === formulario.valores.tipo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </Select>
        )}
      </Field>

      <Field label="Conta ou cartão" erro={erroOrigem}>
        {(p) => (
          <Select {...p} value={origem} onChange={(e) => escolherOrigem(e.target.value)}>
            <option value="">Selecione…</option>
            <optgroup label="Contas">
              {contas.data?.map((c) => (
                <option key={c.id} value={`conta:${c.id}`}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cartões">
              {cartoes.data?.map((c) => (
                <option key={c.id} value={`cartao:${c.id}`}>
                  {c.nome}
                </option>
              ))}
            </optgroup>
          </Select>
        )}
      </Field>

      <Field label="Responsável" erro={formulario.erros.responsavel}>
        {(p) => (
          <Select {...p} {...formulario.campo('responsavel')}>
            <option value="ANA">Ana</option>
            <option value="BRUNO">Bruno</option>
            <option value="CONJUNTA">Conjunta</option>
          </Select>
        )}
      </Field>

      <Field label="Parcela atual" erro={formulario.erros.parcelaAtual}>
        {(p) => (
          <Input {...p} {...formulario.campo('parcelaAtual')} inputMode="numeric" placeholder="—" />
        )}
      </Field>

      <Field label="Total de parcelas" erro={formulario.erros.parcelaTotal}>
        {(p) => (
          <Input {...p} {...formulario.campo('parcelaTotal')} inputMode="numeric" placeholder="—" />
        )}
      </Field>
    </DialogoFormulario>
  );
}
