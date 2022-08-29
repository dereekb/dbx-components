/**
 * A firebase-server environment configuration.
 *
 * Explicitly states whether or not this is a production environment, and optionally some other config.
 *
 * This config is not meant to replace other typical configurations, like .env files, but instead is part of the build system.
 */
export interface FirebaseServerEnvironmentConfig {
  /**
   * Whether or not this is a production environment.
   */
  production: boolean;
  /**
   * (Optional) Whether or not custom "developer tools" should be enabled.
   *
   * In general this is referred to in order to check whether or not to allow skipping typical safety checks in order to speed up local development.
   *
   * This is always false when production is true.
   */
  developerToolsEnabled?: boolean;
}
