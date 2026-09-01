import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Avisos curtos de confirmação e erro.
 *
 * Um `aria-live="polite"` no contêiner faz o leitor de tela anunciar o aviso sem
 * interromper o que estiver lendo. Sem isso, "Lançamento salvo" só existiria
 * para quem enxerga — e a pessoa não saberia se a ação funcionou.
 */
export type TipoAviso = 'sucesso' | 'erro';

interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
}

interface Avisos {
  mostrar: (texto: string, tipo?: TipoAviso) => void;
}

const ToasterContext = createContext<Avisos | null>(null);

const DURACAO = 4000;

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  const mostrar = useCallback((texto: string, tipo: TipoAviso = 'sucesso') => {
    const id = Date.now() + Math.random();
    setAvisos((atual) => [...atual, { id, texto, tipo }]);
  }, []);

  return (
    <ToasterContext.Provider value={{ mostrar }}>
      {children}
      <div className="raiz-toaster" aria-live="polite" aria-atomic="false">
        {avisos.map((aviso) => (
          <ItemAviso
            key={aviso.id}
            aviso={aviso}
            aoSumir={() => setAvisos((atual) => atual.filter((a) => a.id !== aviso.id))}
          />
        ))}
      </div>
    </ToasterContext.Provider>
  );
}

function ItemAviso({ aviso, aoSumir }: { aviso: Aviso; aoSumir: () => void }) {
  useEffect(() => {
    const timer = setTimeout(aoSumir, DURACAO);
    return () => clearTimeout(timer);
  }, [aoSumir]);

  return (
    <div
      className="raiz-toast riseIn"
      // Erro usa role="alert" para ser anunciado na hora; sucesso é polido.
      role={aviso.tipo === 'erro' ? 'alert' : 'status'}
      data-tipo={aviso.tipo}
    >
      {aviso.texto}
      <button
        type="button"
        className="raiz-toast-fechar"
        aria-label="Dispensar aviso"
        onClick={aoSumir}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Fora do provider devolve um no-op em vez de lançar: um aviso perdido é
 * irrelevante perto de derrubar a tela, e isso permite testar telas isoladas.
 */
export function useAvisos(): Avisos {
  return useContext(ToasterContext) ?? { mostrar: () => undefined };
}
