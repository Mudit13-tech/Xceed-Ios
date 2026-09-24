import { createStandaloneToast, extendTheme } from '@chakra-ui/react';
import { learningModuleTheme } from '../learningModule/theme';

/**
 * A toast that can be raised from plain modules — the native download helpers,
 * an interceptor, anything that is not a component and so cannot call
 * `useToast`.
 *
 * Chakra's standalone toast keeps its own renderer, so it needs its own theme
 * (the provider's is not in scope) and its container has to be mounted once at
 * the root; `main.jsx` does that. Everything else about it behaves like the
 * hook — same ids, same `update`, same placement options.
 */
const { ToastContainer, toast } = createStandaloneToast({
  theme: extendTheme(learningModuleTheme),
  defaultOptions: {
    position: 'bottom',
    duration: 5000,
    isClosable: true,
    variant: 'solid',
  },
});

export const appToast = toast;
export const AppToastContainer = ToastContainer;
export default appToast;
