import { type CalcomConfig, type CalcomFactoryConfig } from '@dereekb/calcom';

export type CalcomServiceApiConfig = CalcomConfig & {};

/**
 * Configuration for CalcomService
 */
export abstract class CalcomServiceConfig {
  readonly calcom!: CalcomServiceApiConfig;
  readonly factoryConfig?: CalcomFactoryConfig;

  static assertValidConfig(_config: CalcomServiceConfig) {
    // no required env-specific config currently
  }
}
