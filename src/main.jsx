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

/**
 * The two guardrails on the persisted cache. Both are defaults worth overriding.
 *
 * maxAge: the default is 24 hours, and it is all-or-nothing - one timestamp
 * covers the whole cache, so a cache last written 25 hours ago is thrown away
 * entirely rather than per query. On a phone that is precisely backwards: the
 * stretch of days between opening the app is exactly when there is no network
 * to fall back on, and expiring the cache then turns the one screen that could
 * have worked offline into an empty one. Unbounded is safe here because
 * staleTime is 0 - nothing restored is ever treated as fresh, it is shown while
 * the refetch runs behind it.
 *
 * buster: the release version, so an OTA update starts from an empty cache
 * rather than rehydrating one written by the previous bundle into components
 * that may no longer read that shape.
 *
 * Read from a <meta> tag rather than inlined at build time, and that detail is
 * the whole point. As a `define` it was baked into this module, which lands in
 * the chunk every route imports — so each new version renamed that chunk,
 * rewrote the import path inside all ~270 route chunks and changed their hashes
 * too. Measured across two publishes with no source change at all: 270 chunks,
 * 9.79 MB, rebuilt for nothing, and a delta OTA made every user download it.
 * index.html is imported by no JavaScript, so the same value there renames
 * nothing, and it already changes every release because it names the hashed
 * entry chunk.
 *
 * Deliberately not a hand-maintained constant. Most of this app arrives by
 * sync from AMS, so a response shape can change without anyone here reviewing
 * it — a "bump this when the shape changes" rule has nobody to enforce it and
 * would be wrong exactly when it mattered. Costing a cold first load per update
 * is the cheaper mistake.
 *
 * The fallback covers the dev server before the tag exists and jsdom under
 * test, where there is no index.html at all; neither persists a cache worth
 * busting.
 */
const bundleVersion =
  (typeof document !== 'undefined' &&
    document.querySelector('meta[name="app-version"]')?.content) ||
  'dev';

const persistOptions = {
  persister: queryPersister,
  maxAge: Infinity,
  buster: bundleVersion,
};

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
          <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
            <App />
          </PersistQueryClientProvider>
        </RecoilRoot>
      </ChakraProvider>
    </HelmetProvider>
  </React.StrictMode>
);