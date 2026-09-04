import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';

import { isInAppRoute, savePendingRoute } from '../utils/deepLink';
import { setupOtaUpdater } from '../utils/otaUpdater';
import { initializePushNotifications } from '../utils/pushNotifications';

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
  useEffect(() => {
    setupOtaUpdater();
  }, []);

  return <NativeAppListeners />;
}
