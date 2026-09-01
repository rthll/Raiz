import { CATEGORY_COLOR_OPTIONS } from '@raiz/core';
import { categoriaSchema } from '@raiz/schemas';
import { Dot, Field, Input, Select } from '@raiz/ui';
import { useEffect } from 'react';
import { useSalvar } from '../api/hooks.js';
import type { Categoria } from '../api/types.js';
import { useFormulario } from '../forms/useFormulario.js';
import { useAvisos } from '../ui/Toaster.js';
import { DialogoFormulario } from './DialogoFormulario.js';

export function CategoriaDialog({
  aberto,
  editando,
  onFechar,
}: {
  aberto: boolean;
  editando?: Categoria | null;
  onFechar: () => void;
}) {
  const salvar = useSalvar<Categoria>('categories');
  const { mostrar } = useAvisos();
  const formulario = useFormulario(categoriaSchema, {});

  useEffect(() => {
    if (!aberto) return;
    formulario.reiniciar({
      nome: editando?.nome ?? '',
      tipo: editando?.tipo ?? 'SAIDA',
      cor: editando?.cor ?? CATEGORY_COLOR_OPTIONS[0].cor,
      orcamentoMensal:
        editando?.orcamentoMensal != null
          ? String(editando.orcamentoMensal).replace('.', ',')
          : '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, editando]);

  const onSalvar = formulario.enviar(async (dados) => {
    await salvar.mutateAsync({ id: editando?.id, dados });
    mostrar(editando ? 'Categoria atualizada.' : 'Categoria criada.');
    onFechar();
  });

  const corAtual = String(formulario.valores.cor ?? '');

  return (
    <DialogoFormulario
      aberto={aberto}
      titulo={editando ? 'Editar categoria' : 'Nova categoria'}
      rotuloSalvar={editando ? 'Salvar alterações' : 'Salvar'}
      formulario={formulario}
      onFechar={onFechar}
      onSalvar={onSalvar}
    >
      <Field label="Nome" largo erro={formulario.erros.nome}>
        {(p) => <Input {...p} {...formulario.campo('nome')} autoFocus />}
      </Field>

      <Field label="Tipo" erro={formulario.erros.tipo}>
        {(p) => (
          <Select {...p} {...formulario.campo('tipo')}>
            <option value="SAIDA">Saída</option>
            <option value="ENTRADA">Entrada</option>
          </Select>
        )}
      </Field>

      <Field
        label="Limite mensal"
        erro={formulario.erros.orcamentoMensal}
        dica="Deixe vazio para não ter limite"
      >
        {(p) => (
          <Input
            {...p}
            {...formulario.campo('orcamentoMensal')}
            inputMode="decimal"
            placeholder="sem limite"
          />
        )}
      </Field>

      <Field label="Cor" erro={formulario.erros.cor}>
        {(p) => (
          <div className="raiz-row">
            <Select {...p} {...formulario.campo('cor')} style={{ flex: 1 }}>
              {CATEGORY_COLOR_OPTIONS.map((opcao) => (
                <option key={opcao.cor} value={opcao.cor}>
                  {opcao.nome}
                </option>
              ))}
            </Select>
            {/* Amostra ao lado: o nome da cor sozinho não mostra qual é. */}
            <Dot cor={corAtual} tamanho={26} />
          </div>
        )}
      </Field>
    </DialogoFormulario>
  );
}
