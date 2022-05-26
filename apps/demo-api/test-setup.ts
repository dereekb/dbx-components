/**
 * Initialize FIREBASE_CONFIG for tests to prevent a warning for firebase not being initialized.
 *
 * NOTE: Warning seems to come when firebase-functions is imported for the first time. For some reason it isn't seeing the emulator's configs? Doesn't affect the @dereekb/firestore-server tests...
 */
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'temp' });
