import { ativoSchema } from '@raiz/schemas';
import { Field, Input, Select } from '@raiz/ui';
import { useEffect } from 'react';
import { useSalvar } from '../api/hooks.js';
import type { Ativo } from '../api/types.js';
import { useFormulario } from '../forms/useFormulario.js';
import { useAvisos } from '../ui/Toaster.js';
import { DialogoFormulario } from './DialogoFormulario.js';

export function AtivoDialog({
  aberto,
  editando,
  onFechar,
}: {
  aberto: boolean;
  editando?: Ativo | null;
  onFechar: () => void;
}) {
  const salvar = useSalvar<Ativo>('assets');
  const { mostrar } = useAvisos();
  const formulario = useFormulario(ativoSchema, {});

  useEffect(() => {
    if (!aberto) return;
    formulario.reiniciar({
      nome: editando?.nome ?? '',
      classe: editando?.classe ?? 'RENDA_FIXA',
      valor: editando ? String(editando.valor).replace('.', ',') : '',
      taxaAnual: editando ? String(editando.taxaAnual).replace('.', ',') : '',
      aporteMensal: editando ? String(editando.aporteMensal).replace('.', ',') : '',
      metaTaxa: editando ? String(editando.metaTaxa).replace('.', ',') : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando]);

  const onSalvar = formulario.enviar(async (dados) => {
    await salvar.mutateAsync({ id: editando?.id, dados });
    mostrar(editando ? 'Ativo atualizado.' : 'Ativo adicionado.');
    onFechar();
  });

  return (
    <DialogoFormulario
      aberto={aberto}
      titulo={editando ? 'Editar ativo' : 'Adicionar ativo'}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Salvar'}
      formulario={formulario}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <Field label="Ativo" largo erro={formulario.erros.nome}>
        {(p) => <Input {...p} {...formulario.campo('nome')} autoFocus />}
      </Field>

      <Field label="Classe" erro={formulario.erros.classe}>
        {(p) => (
          <Select {...p} {...formulario.campo('classe')}>
            <option value="RENDA_FIXA">Renda fixa</option>
            <option value="FUNDOS_IMOBILIARIOS">Fundos imobiliários</option>
            <option value="ACOES_EXTERIOR">Ações exterior</option>
            <option value="ACOES_BRASIL">Ações Brasil</option>
            <option value="CRIPTO">Cripto</option>
          </Select>
        )}
      </Field>

      <Field label="Valor atual" erro={formulario.erros.valor}>
        {(p) => (
          <Input {...p} {...formulario.campo('valor')} inputMode="decimal" placeholder="0,00" />
        )}
      </Field>

      <Field
        label="Taxa de retorno (% a.a.)"
        erro={formulario.erros.taxaAnual}
        dica="Aceita negativa"
      >
        {(p) => (
          <Input {...p} {...formulario.campo('taxaAnual')} inputMode="decimal" placeholder="0,0" />
        )}
      </Field>

      <Field label="Aporte mensal" erro={formulario.erros.aporteMensal}>
        {(p) => (
          <Input
            {...p}
            {...formulario.campo('aporteMensal')}
            inputMode="decimal"
            placeholder="0,00"
          />
        )}
      </Field>

      <Field label="Meta de rentabilidade (% a.a.)" erro={formulario.erros.metaTaxa}>
        {(p) => (
          <Input {...p} {...formulario.campo('metaTaxa')} inputMode="decimal" placeholder="0,0" />
        )}
      </Field>
    </DialogoFormulario>
  );
}
