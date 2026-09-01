import { metaSchema } from '@raiz/schemas';
import { Field, Input } from '@raiz/ui';
import { useEffect } from 'react';
import { useSalvar } from '../api/hooks.js';
import type { Meta } from '../api/types.js';
import { useFormulario } from '../forms/useFormulario.js';
import { useAvisos } from '../ui/Toaster.js';
import { DialogoFormulario } from './DialogoFormulario.js';

export function MetaDialog({
  aberto,
  editando,
  onFechar,
}: {
  aberto: boolean;
  editando?: Meta | null;
  onFechar: () => void;
}) {
  const salvar = useSalvar<Meta>('goals');
  const { mostrar } = useAvisos();
  const formulario = useFormulario(metaSchema, {});

  useEffect(() => {
    if (!aberto) return;
    formulario.reiniciar({
      nome: editando?.nome ?? '',
      alvo: editando ? String(editando.alvo).replace('.', ',') : '',
      atual: editando ? String(editando.atual).replace('.', ',') : '',
      prazoMeses: editando?.prazoMeses ?? '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando]);

  const onSalvar = formulario.enviar(async (dados) => {
    await salvar.mutateAsync({ id: editando?.id, dados });
    mostrar(editando ? 'Meta atualizada.' : 'Meta criada.');
    onFechar();
  });

  return (
    <DialogoFormulario
      aberto={aberto}
      titulo={editando ? 'Editar meta' : 'Nova meta'}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Salvar'}
      formulario={formulario}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <Field label="Meta" largo erro={formulario.erros.nome}>
        {(p) => <Input {...p} {...formulario.campo('nome')} autoFocus />}
      </Field>

      <Field label="Valor alvo" erro={formulario.erros.alvo}>
        {(p) => (
          <Input {...p} {...formulario.campo('alvo')} inputMode="decimal" placeholder="0,00" />
        )}
      </Field>

      <Field label="Já guardado" erro={formulario.erros.atual}>
        {(p) => (
          <Input {...p} {...formulario.campo('atual')} inputMode="decimal" placeholder="0,00" />
        )}
      </Field>

      <Field label="Prazo em meses" erro={formulario.erros.prazoMeses} dica="Número inteiro">
        {(p) => (
          <Input
            {...p}
            {...formulario.campo('prazoMeses')}
            type="number"
            inputMode="numeric"
            min={1}
          />
        )}
      </Field>
    </DialogoFormulario>
  );
}
