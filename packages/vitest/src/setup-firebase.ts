/**
 * Vitest setup for Firebase projects.
 *
 * Imports the NestJS setup and adds Firebase-specific error suppression
 * for known Firestore teardown errors.
 */
import './setup-nestjs.js';

/**
 * Initialize FIREBASE_CONFIG for tests to prevent a warning for firebase not being initialized.
 */
process.env['FIREBASE_CONFIG'] = JSON.stringify({ projectId: 'temp' });

/**
 * Checks whether the given error is a known Firestore teardown error that can be safely suppressed.
 *
 * These occur when the Firebase SDK has pending internal operations during test teardown:
 * - Client SDK (firebase/firestore): "Firestore shutting down" (FirebaseError code: 'aborted')
 * - Server SDK (@google-cloud/firestore): "The client has already been terminated"
 */
function isFirestoreTeardownError(reason: unknown): boolean {
  let result = false;

  if (reason instanceof Error) {
    const hasAbortedCode = 'code' in reason && (reason as { code: string }).code === 'aborted';
    const isClientTerminated = reason.message?.includes('client has already been terminated');
    result = hasAbortedCode || isClientTerminated;
  }

  return result;
}

process.on('unhandledRejection', (reason: unknown) => {
  if (isFirestoreTeardownError(reason)) {
    console.warn('[vitest.setup.firebase] Suppressed Firestore teardown unhandled rejection:', reason);
    return;
  }

  // Re-throw non-Firebase unhandled rejections so Vitest still catches real issues
  throw reason;
});

process.on('uncaughtException', (error: Error) => {
  if (isFirestoreTeardownError(error)) {
    console.warn('[vitest.setup.firebase] Suppressed Firestore teardown uncaught exception:', error);
    return;
  }

  // Re-throw non-Firebase uncaught exceptions so Vitest still catches real issues
  throw error;
});
