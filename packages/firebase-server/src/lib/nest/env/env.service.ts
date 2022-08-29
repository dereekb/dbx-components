import { Inject, Injectable } from '@nestjs/common';
import { isTestNodeEnv } from '../../env/env';
import { FirebaseServerEnvironmentConfig } from './env.config';
import { FIREBASE_SERVER_ENV_TOKEN } from './env.nest';

/**
 * Reference to a FirebaseServerEnvService
 */
export interface FirebaseServerEnvServiceRef<S extends FirebaseServerEnvService = FirebaseServerEnvService> {
  readonly envService: S;
}

export abstract class FirebaseServerEnvService {
  abstract readonly isTestingEnv: boolean;
  abstract readonly isProduction: boolean;
  abstract readonly isDevelopmentToolsEnabled: boolean;
}

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
