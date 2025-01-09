/**
 * App environment details
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
