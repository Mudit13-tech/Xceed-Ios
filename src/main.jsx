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


import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: Infinity,
    },
  },
});

const helmetContext = {};

// Global handler for 401 Unauthorized responses
const handleUnauthorized = async () => {
  localStorage.removeItem('token');
  try {
    await SecureStoragePlugin.remove({ key: 'user_pin' });
    await SecureStoragePlugin.remove({ key: 'auth_token' });
  } catch (e) {
    // Ignore plugin errors on web or if keys don't exist
  }
  
  // Only redirect if not already on the login page to avoid infinite loops
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

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
    /* Login is the only request that carries cookies. Everything else proves
       who it is with the Authorization header below, and nothing else.

       The server reads the session from the httpOnly `jwt` cookie *first* and
       only falls back to the header (server readAuthToken). That order is what
       made switching accounts a no-op: the cookie is set once, by a password
       login, and script can neither read it nor delete it, so choosing another
       saved account swapped the header while the cookie still named the
       previous account — and the cookie won. The app showed the new name and
       every request resolved to the old user.

       Since the header is the one identity this client controls, it has to be
       the only one on the wire. Sending cookies just while there is no token
       would not do: a 401 clears the token (see handleUnauthorized), and the
       next request would fall back onto the stale cookie and silently restore
       the account the user had switched away from.

       Nothing is lost by omitting them. `jwt` is the only cookie the server
       reads anywhere, csrfGuard is satisfied by the X-App-Name header below,
       the captcha carries its token in the body, and a guest — joining a Short,
       answering a shared form — is identified by X-Short-Guest. Login keeps
       `include` so the server can still set the cookie, which is what lets
       <img> subresources on the attendance/ML screens authenticate: they cannot
       set a header, so the cookie is the only credential they have. */
    options.credentials = target.startsWith(`${apiOrigin}/auth/login`) ? 'include' : 'omit';
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
      'X-App-Name': 'xceed-learning',
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
  config.headers['X-App-Name'] = 'xceed-learning';
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // And no cookie, for the same reason as the fetch wrapper: it names whichever
  // account logged in with a password last, the server prefers it over the
  // header, and an account switch cannot change it. Sign-in is the one request
  // that needs it and that goes through fetch, not axios.
  config.withCredentials = false;
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server returns a 401 Unauthorized, automatically log out
    if (error.response && error.response.status === 401) {
      handleUnauthorized();
    }
    return Promise.reject(error);
  }
);

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