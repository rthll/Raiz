import { contaSchema } from '@raiz/schemas';
import { Field, Input, Select } from '@raiz/ui';
import { useEffect } from 'react';
import { useSalvar } from '../api/hooks.js';
import type { Conta } from '../api/types.js';
import { useFormulario } from '../forms/useFormulario.js';
import { useAvisos } from '../ui/Toaster.js';
import { DialogoFormulario } from './DialogoFormulario.js';

export function ContaDialog({
  aberto,
  editando,
  onFechar,
}: {
  aberto: boolean;
  editando?: Conta | null;
  onFechar: () => void;
}) {
  const salvar = useSalvar<Conta>('accounts');
  const { mostrar } = useAvisos();
  const formulario = useFormulario(contaSchema, {});

  useEffect(() => {
    if (!aberto) return;
    formulario.reiniciar({
      nome: editando?.nome ?? '',
      tipo: editando?.tipo ?? 'CORRENTE',
      dono: editando?.dono ?? '',
      saldo: editando ? String(editando.saldo).replace('.', ',') : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando]);

  const onSalvar = formulario.enviar(async (dados) => {
    await salvar.mutateAsync({ id: editando?.id, dados });
    mostrar(editando ? 'Conta atualizada.' : 'Conta criada.');
    onFechar();
  });

  return (
    <DialogoFormulario
      aberto={aberto}
      titulo={editando ? 'Editar conta' : 'Nova conta'}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Salvar'}
      formulario={formulario}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <Field label="Nome" erro={formulario.erros.nome}>
        {(p) => <Input {...p} {...formulario.campo('nome')} autoFocus />}
      </Field>

      <Field label="Tipo" erro={formulario.erros.tipo}>
        {(p) => (
          <Select {...p} {...formulario.campo('tipo')}>
            <option value="CORRENTE">Conta corrente</option>
            <option value="CONJUNTA">Conta conjunta</option>
            <option value="POUPANCA">Poupança</option>
          </Select>
        )}
      </Field>

      <Field label="Dono" erro={formulario.erros.dono} dica="Ana, Bruno ou Conjunta">
        {(p) => <Input {...p} {...formulario.campo('dono')} />}
      </Field>

      <Field label="Saldo" erro={formulario.erros.saldo}>
        {(p) => (
          <Input {...p} {...formulario.campo('saldo')} inputMode="decimal" placeholder="0,00" />
        )}
      </Field>
    </DialogoFormulario>
  );
}
