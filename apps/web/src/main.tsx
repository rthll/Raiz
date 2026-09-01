import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@raiz/ui/organic.css';
import '@raiz/ui/components.css';
import './app.css';
import { ApiError } from './api/client.js';
import { App } from './App.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados financeiros do mês não mudam a cada foco de janela.
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: (tentativas, erro) => {
        // 4xx não melhora com repetição — só 5xx e falha de rede merecem retry.
        if (erro instanceof ApiError && erro.status < 500) return false;
        return tentativas < 2;
      },
    },
  },
});

const container = document.getElementById('root');
if (!container) throw new Error('#root não encontrado no index.html');

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
