import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { HelmetProvider } from 'react-helmet-async';
import { ChakraProvider, extendTheme } from '@chakra-ui/react';
import './index.css';
import { RecoilRoot } from 'recoil';
import axios from 'axios';
import getEnvironment from './getenvironment';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { queryPersister } from './utils/queryPersister';
import { learningModuleTheme } from './learningModule/theme';
import {
  APP_NAME,
  credentialsFor,
  handleUnauthorized,
  installAxiosSessionGuard,
} from './mobile/httpSession';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
    },
  },
});

const helmetContext = {};

const originalFetch = window.fetch;
// The API host varies by deployment, so ask getEnvironment rather than listing
// hosts here — a missed host means no Authorization header, and the session
// then rests entirely on a SameSite=None cookie that private windows drop.
const apiOrigin = getEnvironment();
window.fetch = async function(url, options = {}) {
  const token = localStorage.getItem('token');
  const target = typeof url === 'string' ? url : url?.url || String(url ?? '');
  const isOwnServer = target.startsWith(apiOrigin);

  if (isOwnServer) {
    options.credentials = credentialsFor(target, apiOrigin);
    options.headers = {
      ...options.headers,
      /* Names this app on every call to our own API, signed in or not.
         The server refuses a state-changing request that carries no header a
         cross-site form could not have set (see server csrfGuard): the session
         cookie is SameSite=None, so a page on any origin can post it back, and
         a header is the one thing such a page cannot add. It has to go on
         unconditionally rather than beside the token, because the requests with
         no token — a guest joining a Short or answering a shared form — are
         exactly the ones that would otherwise arrive with nothing to prove. */
      'X-App-Name': APP_NAME,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }
  
  const response = await originalFetch(url, options);
  
  // Intercept 401 errors from our own API
  if (response.status === 401 && isOwnServer) {
    handleUnauthorized();
  }
  
  return response;
};

axios.defaults.withCredentials = false;
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  // Same reasoning as the fetch wrapper above: the header is the CSRF proof, so
  // it goes on whether or not there is a token to go with it.
  config.headers['X-App-Name'] = APP_NAME;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.withCredentials = false;
  return config;
});

installAxiosSessionGuard();

/**
 * Semantic colour tokens must be registered on the theme at the provider, which
 * is here — there is nowhere else Chakra reads them from. The addition is purely
 * additive: a new `lmGray` scale and new token names under an `lm` prefix, with
 * no override of any existing scale or component style, so every other module
 * renders exactly as before. The definitions live in learningModule/theme.js.
 */
const appTheme = extendTheme(learningModuleTheme);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider context={helmetContext}>
      <ChakraProvider theme={appTheme}>
        <RecoilRoot>
          <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
            <App />
          </PersistQueryClientProvider>
        </RecoilRoot>
      </ChakraProvider>
    </HelmetProvider>
  </React.StrictMode>
);