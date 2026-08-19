/**
 * The subset of the demo project's Firebase web-app config that has to agree across every
 * consumer: the Angular app (which initializes the client SDK with it), demo-api (which mints App
 * Check attestations for {@link DemoFirebaseClientConfig.appId}), and demo-cli (which opens a
 * direct-Firestore session against the same registered app).
 *
 * These are public identifiers, not secrets — the same values a browser ships in its bundle.
 */
export interface DemoFirebaseClientConfig {
  /**
   * The Firebase web API key.
   */
  readonly apiKey: string;
  /**
   * The project's auth domain.
   */
  readonly authDomain: string;
  /**
   * The Firebase project id.
   */
  readonly projectId: string;
  /**
   * The registered **web** app id. An App Check attestation is minted for this app specifically, so
   * a client that initializes with a different `appId` than the API attests for is rejected wherever
   * App Check is enforced — which is why this value is shared rather than restated per consumer.
   */
  readonly appId: string;
}

/**
 * The demo project's public Firebase web-app client config.
 *
 * Single source of truth for the values that must match between the app, the API, and the CLI:
 * - `apps/demo/src/environments/base.ts` spreads it into its `DbxFirebaseEnvironmentOptions`.
 * - `DemoSessionApiModule` mints App Check tokens for `appId`.
 * - `DEFAULT_DEMO_CLI_ENVS` hands it to `dbx-cli`'s direct-Firestore session.
 */
export const DEMO_FIREBASE_CLIENT_CONFIG: DemoFirebaseClientConfig = {
  apiKey: 'AIzaSyBl5QlQNS-AGrGIuZRI4CDHHBzUovUDABM',
  authDomain: 'dereekb-components.firebaseapp.com',
  projectId: 'dereekb-components',
  appId: '1:124286307516:web:eb5a7cf891a6fd1b1ed4b9'
};
