import { type Maybe, type WebsiteUrl, type WebsiteUrlDetails } from '@dereekb/util';

/**
 * Reference to a FirebaseServerEnvService
 */
export interface FirebaseServerEnvServiceRef<S extends FirebaseServerEnvService = FirebaseServerEnvService> {
  readonly envService: S;
}

/**
 * Abstract service providing Firebase server environment information such as deployment stage,
 * feature flags, and app URL.
 *
 * Implementations are typically injected via {@link FIREBASE_SERVER_ENV_TOKEN} and
 * backed by a {@link FirebaseServerEnvironmentConfig}.
 */
export abstract class FirebaseServerEnvService {
  /**
   * Whether the server is running in a test/CI environment.
   */
  abstract readonly isTestingEnv: boolean;
  /**
   * Whether the server is running in production.
   */
  abstract readonly isProduction: boolean;
  /**
   * Whether the server is running in a staging environment.
   */
  abstract readonly isStaging: boolean;
  /**
   * Whether developer/debug tools are enabled for this environment.
   */
  abstract readonly developerToolsEnabled: boolean;
  /**
   * Whether the development scheduler (for cron-like tasks) is enabled.
   */
  abstract readonly developmentSchedulerEnabled: boolean;
  /**
   * The application's public URL, if configured.
   */
  abstract readonly appUrl: Maybe<string>;
  /**
   * Parsed URL details for the application URL.
   */
  abstract readonly appUrlDetails: Maybe<WebsiteUrlDetails>;
  /**
   * The full API URL (e.g., 'https://app.example.com/api').
   */
  abstract readonly appApiUrl: Maybe<WebsiteUrl>;
  /**
   * The full webhook URL (e.g., 'https://app.example.com/webhook').
   */
  abstract readonly appWebhookUrl: Maybe<WebsiteUrl>;
  /**
   * Whether the API is enabled (appUrl and globalApiRoutePrefix are both configured).
   */
  abstract readonly isApiEnabled: boolean;
  /**
   * Whether webhooks are enabled (appUrl is configured and webhooks are turned on).
   */
  abstract readonly isWebhooksEnabled: boolean;
}
