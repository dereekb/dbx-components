import { type AppCheckOptions } from 'firebase/app-check';

export interface DbxFirebaseAppCheckConfig extends Partial<Omit<AppCheckOptions, 'provider'>> {
  reCaptchaV3: string;
  /**
   * Whether or not to enable AppCheck debug tokens. AppCheck tokens are only printed into the console, and more actions must be taken.
   * See https://firebase.google.com/docs/app-check/web/debug-provider for more info.
   *
   * Debug tokens are only generated when emulators are disabled, and allowDebugTokens is true.
   */
  allowDebugTokens?: boolean;
  /**
   * If true, disables AppCheck initialization for this app.
   */
  disabled?: boolean;
  /**
   * List of routes that app check is authorized to hit.
   *
   * If not defined, /api/* allowed by default.
   */
  appCheckRoutes?: string[];
}
