/**
 * Abstract token class representing the application's runtime environment configuration.
 *
 * Provided via DI using {@link provideDbxAppEnviroment} and accessed through {@link DbxAppEnviromentService}.
 * Subclass or provide a concrete instance to define environment-specific flags.
 *
 * @example
 * ```typescript
 * const env: DbxAppEnviroment = {
 *   production: false,
 *   testing: true,
 * };
 *
 * // In app config:
 * provideDbxAppEnviroment(env);
 * ```
 */
export abstract class DbxAppEnviroment {
  /**
   * Whether or not this is a production environment.
   */
  abstract production: boolean;
  /**
   * Whether or not this is a testing environment.
   *
   * Generally "production" is false when this is true.
   */
  abstract testing?: boolean;
  /**
   * Whether or not this is a staging environment.
   *
   * Generally "production" is true when this is true.
   */
  abstract staging?: boolean;
}
