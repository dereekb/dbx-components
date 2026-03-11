import { type ClientWebAppUrl } from './client';

/**
 * Configuration holding the client-facing web application URL.
 *
 * Used by backend services that need to generate links pointing to the frontend (e.g., email templates, redirect URLs).
 */
export interface ClientAppConfig {
  readonly clientWebAppUrl: ClientWebAppUrl;
}

/**
 * Abstract service configuration that provides access to the client application config.
 *
 * Subclass this to supply environment-specific client URLs to NestJS services.
 */
export abstract class ClientAppServiceConfig {
  readonly client!: ClientAppConfig;

  /**
   * Validates that the configuration contains a non-empty client web app URL.
   *
   * @param config - The configuration to validate
   * @throws {Error} When `clientWebAppUrl` is not specified
   */
  static assertValidConfig(config: ClientAppServiceConfig) {
    if (!config.client.clientWebAppUrl) {
      throw new Error('No client app url specified.');
    }
  }
}
