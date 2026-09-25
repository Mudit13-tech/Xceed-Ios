/**
 * Moved to `src/utils/usePolling`, because it stopped being an attendance
 * concern the moment the learning module needed the same two guards.
 *
 * Re-exported from here so the thirteen call sites in this module keep working
 * unchanged; new code should import from `../utils/usePolling` directly.
 */
export { default } from '../utils/usePolling';
