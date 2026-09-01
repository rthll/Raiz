import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * O mês selecionado é global.
 *
 * Trocar de mês na Visão geral e navegar para Lançamentos tem de manter o mesmo
 * recorte — se cada tela guardasse o seu, o usuário veria agosto num lugar e
 * setembro no outro sem entender por quê.
 */
interface Competencia {
  mes: string;
  setMes: (mes: string) => void;
  /** Limites do intervalo com dados, para o seletor desabilitar as setas. */
  minimo: string;
  maximo: string;
}

const CompetenciaContext = createContext<Competencia | null>(null);

/** O seed do protótipo vive em agosto de 2026; a série de fluxo vai de março a outubro. */
const MES_INICIAL = '2026-08';
const MINIMO = '2026-01';
const MAXIMO = '2026-12';

export function CompetenciaProvider({ children }: { children: ReactNode }) {
  const [mes, setMes] = useState(MES_INICIAL);
  const valor = useMemo(
    () => ({ mes, setMes, minimo: MINIMO, maximo: MAXIMO }),
    [mes],
  );
  return <CompetenciaContext.Provider value={valor}>{children}</CompetenciaContext.Provider>;
}

export function useCompetencia(): Competencia {
  const contexto = useContext(CompetenciaContext);
  if (!contexto) throw new Error('useCompetencia precisa estar dentro de <CompetenciaProvider>');
  return contexto;
}
