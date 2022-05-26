/**
 * Initialize FIREBASE_CONFIG for tests to prevent a warning for firebase not being initialized.
 */
process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'temp' });
