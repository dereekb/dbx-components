import { Inject, Injectable } from '@nestjs/common';
import { isTestNodeEnv } from './env';
import { type ServerEnvironmentConfig } from './env.config';
import { SERVER_ENV_TOKEN } from './env.nest';

@Injectable()
export class ServerEnvironmentService {
  constructor(@Inject(SERVER_ENV_TOKEN) readonly env: ServerEnvironmentConfig) {}

  get isTestingEnv() {
    return isTestNodeEnv();
  }

  get isProduction() {
    return this.env.production;
  }

  get isStaging() {
    return Boolean(this.env.staging);
  }

  get developerToolsEnabled() {
    return Boolean(!this.isProduction && this.env.developerToolsEnabled);
  }

  get appUrl(): string | undefined {
    return this.env.appUrl;
  }
}
