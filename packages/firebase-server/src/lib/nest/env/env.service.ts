import { Inject, Injectable } from '@nestjs/common';
import { isTestNodeEnv, FirebaseServerEnvService } from '../../env';
import { FirebaseServerEnvironmentConfig } from './env.config';
import { FIREBASE_SERVER_ENV_TOKEN } from './env.nest';

@Injectable()
export class DefaultFirebaseServerEnvService implements FirebaseServerEnvService {
  constructor(@Inject(FIREBASE_SERVER_ENV_TOKEN) readonly env: FirebaseServerEnvironmentConfig) {}

  get isTestingEnv() {
    return isTestNodeEnv();
  }

  get isProduction() {
    return this.env.production;
  }

  /**
   * @deprecated use isDeveloperToolsEnabled instead.
   */
  get isDevelopmentToolsEnabled() {
    return this.developerToolsEnabled;
  }

  get developerToolsEnabled() {
    return Boolean(!this.isProduction && this.env.developerToolsEnabled);
  }
}
