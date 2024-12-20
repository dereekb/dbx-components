/**
 * Reference to a FirebaseServerEnvService
 */
export interface FirebaseServerEnvServiceRef<S extends FirebaseServerEnvService = FirebaseServerEnvService> {
  readonly envService: S;
}

export abstract class FirebaseServerEnvService {
  abstract readonly isTestingEnv: boolean;
  abstract readonly isProduction: boolean;
  abstract readonly isStaging: boolean;
  abstract readonly developerToolsEnabled: boolean;
  abstract readonly developmentSchedulerEnabled: boolean;
}
