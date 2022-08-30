/**
 * Reference to a FirebaseServerEnvService
 */
export interface FirebaseServerEnvServiceRef<S extends FirebaseServerEnvService = FirebaseServerEnvService> {
  readonly envService: S;
}

export abstract class FirebaseServerEnvService {
  abstract readonly isTestingEnv: boolean;
  abstract readonly isProduction: boolean;
  /**
   * @deprecated use isDeveloperToolsEnabled instead.
   */
  abstract readonly isDevelopmentToolsEnabled: boolean;
  abstract readonly developerToolsEnabled: boolean;
}
