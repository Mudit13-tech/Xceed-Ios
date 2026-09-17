import { ChakraProvider } from '@chakra-ui/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';

// Wraps a component the way the real app does (main.jsx), minus AMSLayout
// (which access-gates on a fetch and returns null) and HealthProvider (SSE) —
// only include those explicitly in a test that needs them.
//
// A fresh QueryClient per render, so nothing a test caches reaches the next
// one, and with retries off: a component that fetches through react-query would
// otherwise sit through the default back-off before a test could see its error
// state.
export function renderWithProviders(ui, { route = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ChakraProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ChakraProvider>
    </QueryClientProvider>,
  );
}
