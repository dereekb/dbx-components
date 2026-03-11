import { ServerEnvironmentService } from '@dereekb/nestjs';
import { Injectable } from '@nestjs/common';
import { type FirebaseServerEnvService } from '../../env/env.service';
import { type WebsiteUrlDetails, websiteUrlDetails } from '@dereekb/util';

@Injectable()
export class DefaultFirebaseServerEnvService extends ServerEnvironmentService implements FirebaseServerEnvService {
  private _appUrlDetails: WebsiteUrlDetails | undefined | null = null;

  /**
   * Enabled when not in production and not in a testing environment.
   */
  get developmentSchedulerEnabled() {
    return !this.isProduction && !this.isTestingEnv;
  }

  get appUrlDetails(): WebsiteUrlDetails | undefined {
    if (this._appUrlDetails === null) {
      this._appUrlDetails = this.appUrl ? websiteUrlDetails(this.appUrl) : undefined;
    }

    return this._appUrlDetails;
  }
}
