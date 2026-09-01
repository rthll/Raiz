import { cartaoSchema } from '@raiz/schemas';
import { Field, Input, Select } from '@raiz/ui';
import { useEffect } from 'react';
import { useSalvar } from '../api/hooks.js';
import type { Cartao } from '../api/types.js';
import { useFormulario } from '../forms/useFormulario.js';
import { useAvisos } from '../ui/Toaster.js';
import { DialogoFormulario } from './DialogoFormulario.js';

export function CartaoDialog({
  aberto,
  editando,
  onFechar,
}: {
  aberto: boolean;
  editando?: Cartao | null;
  onFechar: () => void;
}) {
  const salvar = useSalvar<Cartao>('cards');
  const { mostrar } = useAvisos();
  const formulario = useFormulario(cartaoSchema, {});

  useEffect(() => {
    if (!aberto) return;
    formulario.reiniciar({
      nome: editando?.nome ?? '',
      bandeira: editando?.bandeira ?? 'VISA',
      final: editando?.final ?? '',
      limite: editando ? String(editando.limite).replace('.', ',') : '',
      diaFechamento: editando?.diaFechamento ?? '',
      diaVencimento: editando?.diaVencimento ?? '',
      temaEscuro: editando?.temaEscuro ?? false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando]);

  const onSalvar = formulario.enviar(async (dados) => {
    await salvar.mutateAsync({ id: editando?.id, dados });
    mostrar(editando ? 'Cartão atualizado.' : 'Cartão cadastrado.');
    onFechar();
  });

  return (
    <DialogoFormulario
      aberto={aberto}
      titulo={editando ? 'Editar cartão' : 'Cadastrar cartão'}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Salvar'}
      formulario={formulario}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <Field label="Apelido" erro={formulario.erros.nome}>
        {(p) => <Input {...p} {...formulario.campo('nome')} autoFocus />}
      </Field>

      <Field label="Bandeira" erro={formulario.erros.bandeira}>
        {(p) => (
          <Select {...p} {...formulario.campo('bandeira')}>
            <option value="VISA">Visa</option>
            <option value="MASTERCARD">Mastercard</option>
            <option value="ELO">Elo</option>
            <option value="AMEX">Amex</option>
          </Select>
        )}
      </Field>

      <Field label="Final" erro={formulario.erros.final} dica="Os 4 últimos dígitos">
        {(p) => (
          <Input
            {...p}
            {...formulario.campo('final')}
            inputMode="numeric"
            maxLength={4}
            placeholder="0000"
          />
        )}
      </Field>

      <Field label="Limite" erro={formulario.erros.limite}>
        {(p) => (
          <Input {...p} {...formulario.campo('limite')} inputMode="decimal" placeholder="0,00" />
        )}
      </Field>

      <Field
        label="Dia de fechamento"
        erro={formulario.erros.diaFechamento}
        dica="Entre 1 e 28"
      >
        {(p) => (
          <Input {...p} {...formulario.campo('diaFechamento')} inputMode="numeric" type="number" min={1} max={28} />
        )}
      </Field>

      <Field label="Dia de vencimento" erro={formulario.erros.diaVencimento} dica="Entre 1 e 28">
        {(p) => (
          <Input {...p} {...formulario.campo('diaVencimento')} inputMode="numeric" type="number" min={1} max={28} />
        )}
      </Field>
    </DialogoFormulario>
  );
}
