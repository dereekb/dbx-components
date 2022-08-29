import { Inject, Injectable } from '@nestjs/common';
import { isTestNodeEnv } from '../../env/env';
import { FirebaseServerEnvironmentConfig } from './env.config';
import { FIREBASE_SERVER_ENV_TOKEN } from './env.nest';

@Injectable()
export class DefaultFirebaseServerEnvService {
  constructor(@Inject(FIREBASE_SERVER_ENV_TOKEN) readonly env: FirebaseServerEnvironmentConfig) {}

  get isTestingEnv() {
    return isTestNodeEnv();
  }

  get isProduction() {
    return this.env.production;
  }

  get isDevelopmentToolsEnabled() {
    return !this.isProduction && this.env.developerToolsEnabled;
  }
}
