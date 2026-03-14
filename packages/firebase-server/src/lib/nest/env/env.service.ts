import { ServerEnvironmentService } from '@dereekb/nestjs';
import { Injectable } from '@nestjs/common';
import { type FirebaseServerEnvService } from '../../env/env.service';
import { cachedGetter, type Maybe, type WebsiteUrlDetails, websiteUrlDetails } from '@dereekb/util';

/**
 * Default NestJS injectable implementation of {@link FirebaseServerEnvService}.
 *
 * Extends {@link ServerEnvironmentService} from `@dereekb/nestjs` and adds
 * Firebase-specific environment properties like `appUrl` and `developmentSchedulerEnabled`.
 */
@Injectable()
export class DefaultFirebaseServerEnvService extends ServerEnvironmentService implements FirebaseServerEnvService {
  private readonly _appUrlDetails = cachedGetter<Maybe<WebsiteUrlDetails>>(() => (this.appUrl ? websiteUrlDetails(this.appUrl) : undefined));

  /**
   * Enabled when not in production and not in a testing environment.
   */
  get developmentSchedulerEnabled() {
    return !this.isProduction && !this.isTestingEnv;
  }

  get appUrlDetails() {
    return this._appUrlDetails();
  }
}
