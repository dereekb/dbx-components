import { type ServerEnvironmentConfig } from '@dereekb/nestjs';

/**
 * Extension of ServerEnvironmentConfig for Firebase server applications.
 *
 * Requires appUrl to be provided.
 */
export interface FirebaseServerEnvironmentConfig extends ServerEnvironmentConfig {
  readonly appUrl: string;
}
