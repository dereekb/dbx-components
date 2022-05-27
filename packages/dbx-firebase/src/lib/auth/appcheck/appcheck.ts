
/**
 * Enables debug token generation for AppCheck by setting FIREBASE_APPCHECK_DEBUG_TOKEN in the browser's self/window.
 * 
 * https://firebase.google.com/docs/app-check/web/debug-provider
 * 
 * @param enable 
 */
 export function enableAppCheckDebugTokenGeneration(enable = true) {
  (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean }).FIREBASE_APPCHECK_DEBUG_TOKEN = enable;
}
