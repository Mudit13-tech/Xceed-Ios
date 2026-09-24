/**
 * Announces students whose quiz attempt was terminated since the last refresh
 * of a live results page — web implementation, which announces nothing.
 * See ./README.md.
 *
 * Returns the function the page calls with each fetched results payload.
 */
const announceNothing = () => {};

export function useTerminationAlerts() {
  return announceNothing;
}

export default useTerminationAlerts;
