import { ZoomConfig, ZoomFactoryConfig } from '@dereekb/zoom';

export type ZoomServiceApiConfig = ZoomConfig & {};

/**
 * Configuration for ZoomService
 */
export abstract class ZoomServiceConfig {
  readonly zoom!: ZoomServiceApiConfig;
  readonly factoryConfig?: ZoomFactoryConfig;

  static assertValidConfig(config: ZoomServiceConfig) {
    // TODO?
  }
}
