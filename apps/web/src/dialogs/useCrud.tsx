import { ConfirmDialog } from '@raiz/ui';
import { useCallback, useState } from 'react';
import { ApiError } from '../api/client.js';
import { useExcluir } from '../api/hooks.js';
import { useAvisos } from '../ui/Toaster.js';

type Recurso = Parameters<typeof useExcluir>[0];

/**
 * O ciclo abrir / editar / excluir-com-confirmação, que é idêntico nas sete
 * telas de CRUD.
 *
 * Excluir **sempre** passa por confirmação — o handoff pede, e é o único ponto
 * do sistema onde um clique errado destrói dado sem volta.
 */
export function useCrud<T extends { id: string; nome?: string; descricao?: string }>(
  recurso: Recurso,
  rotulo: { singular: string; artigo: 'o' | 'a' },
) {
  const [editando, setEditando] = useState<T | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [paraExcluir, setParaExcluir] = useState<T | null>(null);
  const excluir = useExcluir(recurso);
  const { mostrar } = useAvisos();

  const abrirNovo = useCallback(() => {
    setEditando(null);
    setDialogoAberto(true);
  }, []);

  const abrirEdicao = useCallback((item: T) => {
    setEditando(item);
    setDialogoAberto(true);
  }, []);

  const fechar = useCallback(() => {
    setDialogoAberto(false);
    setEditando(null);
  }, []);

  const confirmarExclusao = useCallback(async () => {
    if (!paraExcluir) return;
    try {
      await excluir.mutateAsync(paraExcluir.id);
      mostrar(`${rotulo.singular} excluíd${rotulo.artigo === 'o' ? 'o' : 'a'}.`);
      setParaExcluir(null);
    } catch (erro) {
      // 409 significa que há dado dependente — a mensagem da API explica qual.
      mostrar(
        erro instanceof ApiError ? erro.message : 'Não foi possível excluir.',
        'erro',
      );
      setParaExcluir(null);
    }
  }, [paraExcluir, excluir, mostrar, rotulo]);

  const nomeDoItem = paraExcluir?.nome ?? paraExcluir?.descricao ?? '';

  const confirmacao = (
    <ConfirmDialog
      aberto={!!paraExcluir}
      titulo={`Excluir ${rotulo.artigo === 'o' ? 'o' : 'a'} ${rotulo.singular.toLowerCase()}?`}
      descricao={
        nomeDoItem
          ? `"${nomeDoItem}" será removid${rotulo.artigo === 'o' ? 'o' : 'a'} permanentemente. Não dá para desfazer.`
          : 'Esta ação não pode ser desfeita.'
      }
      rotuloConfirmar="Excluir"
      carregando={excluir.isPending}
      onConfirmar={() => void confirmarExclusao()}
      onCancelar={() => setParaExcluir(null)}
    />
  );

  return {
    editando,
    dialogoAberto,
    abrirNovo,
    abrirEdicao,
    fechar,
    pedirExclusao: setParaExcluir,
    confirmacao,
  };
}
