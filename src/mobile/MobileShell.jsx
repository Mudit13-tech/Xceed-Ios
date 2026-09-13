import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import {
  Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, ModalOverlay, Text,
} from '@chakra-ui/react';

import { isInAppRoute, savePendingRoute } from '../utils/deepLink';
import { setupOtaUpdater } from '../utils/otaUpdater';
import { initializePushNotifications } from '../utils/pushNotifications';
import { configureStatusBar } from './statusBar';

/**
 * Everything the app does that a browser tab cannot: the hardware back key,
 * deep links, push notifications and the over-the-air updater.
 *
 * This lives here rather than in App.jsx because App.jsx is not ours. It comes
 * from the AMS client on every sync and the web team edits it constantly — it
 * is among the files they touch most — so the hundred lines below spent years
 * sitting directly in the middle of a file that upstream keeps rewriting
 * around them. Moving them out leaves a single <MobileShell /> in App.jsx: one
 * line, in the render tree, that AMS has no reason to touch and that survives
 * whatever they do to the routes above and below it.
 *
 * Rendered inside <Router>, because the listeners navigate.
 */
let isAppColdStart = true;

function NativeAppListeners() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const locationRef = React.useRef(location.pathname);
  const navigateRef = React.useRef(navigate);

  // Keep refs updated without triggering the listener effect
  React.useEffect(() => {
    locationRef.current = location.pathname;
    navigateRef.current = navigate;
  }, [location.pathname, navigate]);

  // Runs once, before anything paints below the notch. See ./statusBar.js for
  // why this is a status-bar call rather than CSS.
  React.useEffect(() => { configureStatusBar(); }, []);

  React.useEffect(() => {
    let backButtonListener = null;
    let appUrlListener = null;

    const registerListener = async () => {
      backButtonListener = await CapacitorApp.addListener('backButton', (event) => {
        // Paths where pressing back should exit the app instead of navigating back
        const exitPaths = ['/', '/login', '/home', '/learning', '/learning/'];
        if (exitPaths.includes(locationRef.current)) {
          CapacitorApp.exitApp();
        } else if (event.canGoBack || window.history.length > 1) {
          navigateRef.current(-1);
        } else {
          CapacitorApp.exitApp();
        }
      });

      appUrlListener = await CapacitorApp.addListener('appUrlOpen', async (event) => {
        try {
          const url = new URL(event.url);
          if (url.hostname === 'xceed.nitj.ac.in' || url.hostname === 'xceed.learning.app') {
            const path = url.pathname + url.search + url.hash;

            // Not every URL on our hosts is a screen. The app-links filter in
            // AndroidManifest.xml claims all of them, so a file the API serves
            // — `/api/v1/learningmodule/file/....pdf` — is handed to us here
            // exactly like a class link is. Routing to it used to send the
            // WebView to the local asset server for a PDF it has never had:
            // net::ERR_INVALID_RESPONSE, with the file never fetched. Android
            // has given us the intent either way, so save the download rather
            // than drop it. See src/utils/deepLink.js.
            if (path && path !== '/' && !isInAppRoute(path)) {
              // Imported here rather than at the top: this is the boot bundle,
              // and the native helpers pull in the camera, share and picker
              // plugins that nothing on the first screen needs.
              const { downloadFileNative } = await import('../utils/nativeCapabilities');
              downloadFileNative(url.href, url.pathname.split('/').pop()).catch(() => {});
              return;
            }

            if (path && path !== '/') {
              await savePendingRoute(path);
              if (isAppColdStart) {
                // Cold start: enforce PIN screen
                navigateRef.current('/login');
              } else {
                // Background resume: navigate directly
                navigateRef.current(path);
              }
            }
          }
        } catch (e) {
          console.error('Invalid deep link URL:', e);
        }
      });
      
      // After a short delay, the app is considered "running" rather than cold-starting
      setTimeout(() => {
        isAppColdStart = false;
      }, 3000);
    };

    registerListener();

    // Initialize Push Notifications using the stable navigate ref wrapper
    initializePushNotifications((...args) => navigateRef.current(...args));

    return () => {
      if (backButtonListener) {
        backButtonListener.remove();
      }
      if (appUrlListener) {
        appUrlListener.remove();
      }
    };
  }, []); // Empty dependency array ensures this runs exactly once!

  return null;
}

/**
 * The single element App.jsx renders. Kept as a wrapper around the listeners
 * so that anything else the app needs at boot can be added here instead of
 * going back into App.jsx for a second line.
 */
export default function MobileShell() {
  // Either null, { kind: 'update', version } or { kind: 'failed' }. One piece
  // of state for one dialog: the updater never raises both at once.
  const [dialog, setDialog] = useState(null);
  const [applying, setApplying] = useState(false);
  // Held so the button press can let setupOtaUpdater carry on to the apply.
  const confirmRef = useRef(null);

  useEffect(() => {
    // A development build has to be able to keep the code that was built into
    // it. The updater compares this bundle's version against the server's and,
    // finding the server ahead, replaces the web assets with production's --
    // so a device build would run for a few seconds and then silently revert
    // to whatever is live, taking every local change with it. That is correct
    // for a user and useless for testing, and it is invisible while it happens:
    // the app simply stops having the fix you just installed.
    //
    // VITE_DISABLE_OTA is read only to turn the updater off, and lives in .env,
    // which is gitignored. A release build has no .env, so OTA stays on by
    // default and nothing about shipping changes.
    if (import.meta.env.VITE_DISABLE_OTA === '1') {
      console.log('[OTA] Disabled for this build (VITE_DISABLE_OTA=1) — keeping the bundle that was installed.');
      return;
    }

    setupOtaUpdater({
      onUpdateDownloaded: (version) =>
        new Promise((resolve) => {
          confirmRef.current = resolve;
          setDialog({ kind: 'update', version });
        }),
      onUpdateFailed: () => setDialog({ kind: 'failed' }),
    });
  }, []);

  const applyUpdate = () => {
    // The apply reloads the app out from under this dialog, so the button is
    // left in its loading state rather than closing: there is no after.
    setApplying(true);
    if (confirmRef.current) confirmRef.current();
  };

  const isUpdate = dialog !== null && dialog.kind === 'update';

  return (
    <>
      <NativeAppListeners />
      {/* The update dialog cannot be dismissed: it is applied the moment it
          resolves either way, so an exit that implied otherwise would be a
          lie. The failure one dismisses freely — nothing depends on it. */}
      <Modal
        isOpen={dialog !== null}
        onClose={() => { if (!isUpdate) setDialog(null); }}
        isCentered
        closeOnOverlayClick={!isUpdate}
      >
        <ModalOverlay />
        <ModalContent mx={4} borderRadius="xl">
          <ModalHeader pb={2}>
            {isUpdate ? 'Update ready' : 'Couldn’t check for updates'}
          </ModalHeader>
          <ModalBody pt={0}>
            <Text fontSize="sm" color="gray.600">
              {isUpdate
                ? `Version ${dialog.version} has been downloaded. The app will restart to finish installing it.`
                : 'The app is working normally and will try again next time you open it. If this keeps happening, connect to NITJ WiFi.'}
            </Text>
          </ModalBody>
          <ModalFooter>
            {isUpdate ? (
              <Button
                colorScheme="blue"
                width="100%"
                onClick={applyUpdate}
                isLoading={applying}
                loadingText="Restarting"
              >
                Restart now
              </Button>
            ) : (
              <Button variant="ghost" width="100%" onClick={() => setDialog(null)}>
                Dismiss
              </Button>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
