import type { RegistroInput } from '@raiz/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { aoExpirarSessao, definirAccessToken, patch, post } from '../api/client.js';
import type { Preferencias, Usuario } from '../api/types.js';

interface Sessao {
  usuario: Usuario | null;
  carregando: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  criarConta: (dados: RegistroInput) => Promise<void>;
  sair: () => Promise<void>;
  atualizarPreferencias: (mudanca: Preferencias) => Promise<void>;
}

const AuthContext = createContext<Sessao | null>(null);

interface RespostaAuth {
  accessToken: string;
  usuario: Usuario;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const qc = useQueryClient();

  /**
   * Na abertura, tenta restaurar a sessão pelo cookie httpOnly de refresh.
   * É o que faz um F5 não jogar o usuário para o login.
   */
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const dados = await post<RespostaAuth>('/auth/refresh');
        if (cancelado) return;
        definirAccessToken(dados.accessToken);
        setUsuario(dados.usuario);
      } catch {
        // Sem cookie válido: é o estado normal de quem nunca entrou.
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  // Quando o refresh falha no meio da navegação, o cliente avisa por aqui.
  useEffect(() => {
    aoExpirarSessao(() => {
      setUsuario(null);
      qc.clear();
    });
  }, [qc]);

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const dados = await post<RespostaAuth>('/auth/login', { email, senha });
      definirAccessToken(dados.accessToken);
      setUsuario(dados.usuario);
    },
    [],
  );

  /**
   * Registro entra já autenticado: a rota devolve o mesmo par accessToken +
   * usuário do login e grava o cookie de refresh. Mandar para a tela de login
   * logo depois de criar a conta seria pedir a senha duas vezes seguidas.
   */
  const criarConta = useCallback(async (dados: RegistroInput) => {
    const resposta = await post<RespostaAuth>('/auth/register', dados);
    definirAccessToken(resposta.accessToken);
    setUsuario(resposta.usuario);
  }, []);

  const sair = useCallback(async () => {
    try {
      await post('/auth/logout');
    } finally {
      definirAccessToken(null);
      setUsuario(null);
      // Limpa o cache: os dados da casa anterior não podem sobrar na tela.
      qc.clear();
    }
  }, [qc]);

  const atualizarPreferencias = useCallback(async (mudanca: Preferencias) => {
    // A rota é PATCH: são alterações parciais das três flags.
    const dados = await patch<{ usuario: Usuario }>('/auth/preferencias', mudanca);
    setUsuario(dados.usuario);
  }, []);

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, entrar, criarConta, sair, atualizarPreferencias }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Sessao {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return contexto;
}

/**
 * Preferências com os padrões aplicados.
 *
 * Diferente de `useAuth`, **não lança** fora do provider: são três flags de
 * exibição com padrão sensato, e derrubar a tela inteira por falta delas é
 * desproporcional. Isso também permite renderizar qualquer tela isolada.
 */
export function usePreferencias(): Required<Preferencias> {
  const contexto = useContext(AuthContext);
  const preferencias = contexto?.usuario?.preferencias;
  return {
    modoPrivacidade: preferencias?.modoPrivacidade ?? false,
    modoCasal: preferencias?.modoCasal ?? true,
    alertasVencimento: preferencias?.alertasVencimento ?? true,
  };
}
