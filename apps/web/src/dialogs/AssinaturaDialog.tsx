import { assinaturaSchema } from '@raiz/schemas';
import { Field, Input, Select, Textarea } from '@raiz/ui';
import { useEffect } from 'react';
import { useCartoes, useCategorias, useSalvar } from '../api/hooks.js';
import type { Assinatura } from '../api/types.js';
import { useFormulario } from '../forms/useFormulario.js';
import { useAvisos } from '../ui/Toaster.js';
import { DialogoFormulario } from './DialogoFormulario.js';

export function AssinaturaDialog({
  aberto,
  editando,
  dataPadrao,
  onFechar,
}: {
  aberto: boolean;
  editando?: Assinatura | null;
  dataPadrao: string;
  onFechar: () => void;
}) {
  const cartoes = useCartoes();
  const categorias = useCategorias();
  const salvar = useSalvar<Assinatura>('subscriptions');
  const { mostrar } = useAvisos();
  const formulario = useFormulario(assinaturaSchema, {});

  useEffect(() => {
    if (!aberto) return;
    formulario.reiniciar({
      nome: editando?.nome ?? '',
      valor: editando ? String(editando.valor).replace('.', ',') : '',
      periodo: editando?.periodo ?? 'MENSAL',
      proximoDebito: editando?.proximoDebito ?? dataPadrao,
      cardId: editando?.cardId ?? '',
      categoriaId: editando?.categoriaId ?? '',
      status: editando?.status ?? 'ATIVA',
      observacao: editando?.observacao ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando, dataPadrao]);

  const onSalvar = formulario.enviar(async (dados) => {
    await salvar.mutateAsync({
      id: editando?.id,
      // `<select>` devolve string vazia, não null, quando nada é escolhido.
      dados: { ...(dados as object), cardId: formulario.valores.cardId || null },
    });
    mostrar(editando ? 'Assinatura atualizada.' : 'Assinatura criada.');
    onFechar();
  });

  return (
    <DialogoFormulario
      aberto={aberto}
      titulo={editando ? 'Editar assinatura' : 'Nova assinatura'}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Salvar'}
      formulario={formulario}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <Field label="Serviço" largo erro={formulario.erros.nome}>
        {(p) => <Input {...p} {...formulario.campo('nome')} autoFocus />}
      </Field>

      <Field
        label="Valor cobrado"
        erro={formulario.erros.valor}
        dica="Zero para teste grátis"
      >
        {(p) => (
          <Input {...p} {...formulario.campo('valor')} inputMode="decimal" placeholder="0,00" />
        )}
      </Field>

      <Field label="Período" erro={formulario.erros.periodo}>
        {(p) => (
          <Select {...p} {...formulario.campo('periodo')}>
            <option value="MENSAL">Mensal</option>
            <option value="TRIMESTRAL">Trimestral</option>
            <option value="SEMESTRAL">Semestral</option>
            <option value="ANUAL">Anual</option>
          </Select>
        )}
      </Field>

      <Field label="Próximo débito" erro={formulario.erros.proximoDebito}>
        {(p) => <Input {...p} {...formulario.campo('proximoDebito')} type="date" />}
      </Field>

      <Field label="Cartão" erro={formulario.erros.cardId}>
        {(p) => (
          <Select {...p} {...formulario.campo('cardId')}>
            <option value="">Sem cartão</option>
            {cartoes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Categoria" erro={formulario.erros.categoriaId}>
        {(p) => (
          <Select {...p} {...formulario.campo('categoriaId')}>
            <option value="">Selecione…</option>
            {categorias.data
              ?.filter((c) => c.tipo === 'SAIDA')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </Select>
        )}
      </Field>

      <Field label="Status" erro={formulario.erros.status}>
        {(p) => (
          <Select {...p} {...formulario.campo('status')}>
            <option value="ATIVA">Ativa</option>
            <option value="PAUSADA">Pausada</option>
            <option value="TESTE">Teste grátis</option>
          </Select>
        )}
      </Field>

      <Field label="Observação" largo erro={formulario.erros.observacao}>
        {(p) => <Textarea {...p} {...formulario.campo('observacao')} rows={2} />}
      </Field>
    </DialogoFormulario>
  );
}
