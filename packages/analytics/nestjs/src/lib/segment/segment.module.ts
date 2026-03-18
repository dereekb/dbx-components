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
