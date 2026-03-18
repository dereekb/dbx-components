import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ServerEnvironmentService } from '@dereekb/nestjs';
import { SegmentApi } from './segment.api';
import { SegmentServiceConfig } from './segment.config';
import { SegmentService } from './segment.service';

/**
 * Factory that creates a SegmentServiceConfig from environment variables.
 *
 * When a {@link ServerEnvironmentService} is provided and the current environment is a
 * testing environment, `logOnly` is forced to true regardless of the env variable.
 *
 * @param configService - NestJS ConfigService for reading environment variables.
 * @param serverEnvironmentService - Service that identifies the current server environment.
 * @returns A validated {@link SegmentServiceConfig} instance.
 *
 * @example
 * ```ts
 * const config = segmentServiceConfigFactory(configService, serverEnvironmentService);
 * ```
 */
export function segmentServiceConfigFactory(configService: ConfigService, serverEnvironmentService: ServerEnvironmentService): SegmentServiceConfig {
  const isTestingEnv = serverEnvironmentService.isTestingEnv;
  const logOnly = isTestingEnv || configService.get<string>('SEGMENT_LOG_ONLY', 'false') === 'true';

  const config: SegmentServiceConfig = {
    writeKey: configService.get<string>('SEGMENT_WRITE_KEY', ''),
    logOnly
  };

  SegmentServiceConfig.assertValidConfig(config);
  return config;
}

/**
 * NestJS module that provides the {@link SegmentService} and its dependencies.
 *
 * Reads `SEGMENT_WRITE_KEY` and `SEGMENT_LOG_ONLY` from environment variables via {@link ConfigModule}.
 * When a {@link ServerEnvironmentService} is available and the environment is a testing environment,
 * `logOnly` is forced to `true`.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: SegmentServiceConfig,
      inject: [ConfigService, ServerEnvironmentService],
      useFactory: segmentServiceConfigFactory
    },
    SegmentApi,
    SegmentService
  ],
  exports: [SegmentService]
})
export class SegmentServiceModule {}
