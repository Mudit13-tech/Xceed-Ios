/**
 * Clears what the device keeps of a session besides the token — web
 * implementation. The browser keeps nothing else, so there is nothing to do.
 * (The app keeps saved accounts and a PIN in the device keystore and clears
 * them here.) See ./README.md.
 */
export async function clearNativeSession() {}

export default clearNativeSession;
