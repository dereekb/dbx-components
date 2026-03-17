import { type DynamicModule, Module } from '@nestjs/common';
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

/**
 * NestJS module that provides SegmentService.
 *
 * Use `forRoot()` to provide a SegmentServiceConfig directly, or `forRootAsync()`
 * to read configuration from environment variables via ConfigService.
 *
 * When using `forRootAsync()`, the {@link ServerEnvironmentService} is injected to
 * automatically force log-only mode in testing environments.
 */
@Module({})
export class SegmentServiceModule {
  /**
   * Configures the module with an explicit SegmentServiceConfig.
   */
  static forRoot(config: SegmentServiceConfig): DynamicModule {
    return {
      module: SegmentServiceModule,
      providers: [
        {
          provide: SegmentServiceConfig,
          useValue: config
        },
        SegmentApi,
        SegmentService
      ],
      exports: [SegmentService]
    };
  }

  /**
   * Configures the module using environment variables via ConfigService.
   *
   * Reads `SEGMENT_WRITE_KEY` and `SEGMENT_LOG_ONLY` from the environment.
   * Injects {@link ServerEnvironmentService} to force log-only mode in testing environments.
   */
  static forRootAsync(): DynamicModule {
    return {
      module: SegmentServiceModule,
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
    };
  }
}
