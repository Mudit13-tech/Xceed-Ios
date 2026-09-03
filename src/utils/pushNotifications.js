import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { isInAppRoute, savePendingRoute } from './deepLink';
import axios from 'axios';
import getEnvironment from '../getenvironment';

const apiUrl = getEnvironment();

export const initializePushNotifications = async (navigate) => {
  // Push notifications are only supported on native devices (Android/iOS)
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications are not supported on web.');
    return;
  }
  console.log('Confirmed Native Platform for Push.');

  try {
    // 1. REGISTER LISTENERS FIRST
    // On success, we should be able to receive notifications
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      // Send token to our backend
      try {
        await axios.post(
          `${apiUrl}/api/v1/learningmodule/fcm-token`,
          {
            token: token.value,
            platform: Capacitor.getPlatform(),
          },
          { withCredentials: true }
        );
        console.log('FCM token registered with backend.');
      } catch (err) {
        console.error('Failed to register FCM token with backend:', err);
      }
    });

    // Some issue with our setup and push will not work
    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on push registration: ', JSON.stringify(error));
    });

    // Show us the notification payload if the app is open on our device
    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push received: ', JSON.stringify(notification));
      // Optionally trigger local UI toast/alert here if desired
    });

    // Method called when tapping on a notification
    PushNotifications.addListener('pushNotificationActionPerformed', async (notification) => {
      console.log('Push action performed: ', JSON.stringify(notification));
      const data = notification.notification.data;
      
      // Handle "Let back in" action button or a direct tap on the notification body
      if (notification.actionId === 'let_back_in' || notification.actionId === 'tap') {
        const { classId, attemptId, autoMinutes, studentName } = data;
        
        // If it's a direct tap, show the dialog first
        let shouldReopen = false;
        if (notification.actionId === 'tap' && classId && attemptId && autoMinutes) {
          const name = studentName || 'this student';
          shouldReopen = window.confirm(`Do you want to let ${name} back into the exam for ${autoMinutes} minutes?`);
        } else if (notification.actionId === 'let_back_in') {
          shouldReopen = true; // Quick action button tapped, proceed immediately
        }

        if (shouldReopen && classId && attemptId) {
          try {
             await axios.post(`${apiUrl}/api/v1/learningmodule/class/${classId}/quiz-attempt/${attemptId}/reopen`, {
                 mode: 'continue',
                 minutes: Number(autoMinutes) || 30,
                 sebExempt: false
             }, { withCredentials: true });
             console.log('Successfully reopened exam from push action');
             alert('Student has been let back into the exam.');
          } catch(err) {
             console.error('Failed to reopen exam from push action', err);
             alert('Failed to let student back in. Please do it from the dashboard.');
          }
          return; // Stop further navigation since we handled the action
        }
      }

      // If the backend sent a link in the data payload, navigate to it
      if (data && data.link) {
        let route = data.link;
        // Strip the base URL if it's absolute, we want internal routing
        if (route.startsWith('http')) {
           try {
             const url = new URL(route);
             route = url.pathname + url.search;
           } catch(e) {
             // Ignore invalid URL
           }
        }
        
        // `savePendingRoute` keeps a file URL out of the resume slot — see
        // src/utils/deepLink.js — so a notification that links to an
        // attachment cannot strand the next sign-in on the local asset server.
        if (navigate && isInAppRoute(route)) {
          console.log(`Navigating to push link: ${route}`);
          await savePendingRoute(route);
          navigate(route);
        }
      }
    });

    // 2. CHECK PERMISSIONS & REGISTER
    // Request permission to use push notifications
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('User denied push notification permissions.');
      return;
    }

    console.log('Push permissions granted. Registering Action Types...');

    try {
      // Register custom action types for interactive push notifications (mostly iOS)
      await PushNotifications.registerActionTypes({
        types: [
          {
            id: 'EXAM_TERMINATED_ACTIONS',
            actions: [
              {
                id: 'let_back_in',
                title: 'Let back in now',
                foreground: true // Brings app to foreground to ensure cookies/network are active
              }
            ]
          }
        ]
      });
      console.log('Action Types Registered.');
    } catch (actionTypeError) {
      console.log('registerActionTypes skipped (expected on Android): ', actionTypeError.message);
    }
    
    console.log('Calling PushNotifications.register()...');

    // Register with Apple / Google to receive push via APNS/FCM
    await PushNotifications.register();

  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
};

// Function to call on logout to clean up the token
export const unregisterPushToken = async (tokenValue) => {
  if (!Capacitor.isNativePlatform() || !tokenValue) return;
  try {
    await axios.delete(`${apiUrl}/api/v1/learningmodule/fcm-token`, {
      data: { token: tokenValue },
      withCredentials: true,
    });
    console.log('FCM token unregistered from backend.');
  } catch (err) {
    console.error('Failed to unregister FCM token:', err);
  }
};
