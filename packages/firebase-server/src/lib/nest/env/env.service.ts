import { ServerEnvironmentService } from '@dereekb/nestjs';
import { Injectable } from '@nestjs/common';
import { FirebaseServerEnvService } from '../../env';

@Injectable()
export class DefaultFirebaseServerEnvService extends ServerEnvironmentService implements FirebaseServerEnvService {
  /**
   * @deprecated use isDeveloperToolsEnabled instead.z
   */
  get isDevelopmentToolsEnabled() {
    return this.developerToolsEnabled;
  }
}
