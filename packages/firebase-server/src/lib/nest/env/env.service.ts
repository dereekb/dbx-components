import { ServerEnvironmentService } from '@dereekb/nestjs';
import { Injectable } from '@nestjs/common';
import { type FirebaseServerEnvService } from '../../env/env.service';

@Injectable()
export class DefaultFirebaseServerEnvService extends ServerEnvironmentService implements FirebaseServerEnvService {
  /**
   * Enabled when not in production and not in a testing environment.
   */
  get developmentSchedulerEnabled() {
    return !this.isProduction && !this.isTestingEnv;
  }
}
