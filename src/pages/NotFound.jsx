import React from 'react';
import Lottie from 'lottie-react';
import ErrorPage from './ErrorPage.jsx';
import animation404 from '../assets/404.json';

/**
 * The catch-all 404, lifted out of `App.jsx` so it can be code-split.
 *
 * It was written inline as a route element, which meant `lottie-react` and the
 * animation JSON were static imports in the app's entry module — downloaded by
 * every student sitting a test, to render a page they hopefully never see.
 * Out here it is loaded only when a route actually misses.
 */
export default function NotFound() {
  return (
    <ErrorPage
      message="The page you are looking for does not exist..."
      destination="/"
      destinationName="Home"
      animation={<Lottie animationData={animation404} style={{ opacity: '15%' }} />}
    />
  );
}
