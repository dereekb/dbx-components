import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { FirebaseServerAnalyticsService, FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type AnalyticsEventData } from '@dereekb/analytics';
import { filterUndefinedValues } from '@dereekb/util';
import { OidcAnalyticsService, type OidcAnalyticsEvent } from './oidc.analytics.handler';
import { DEFAULT_OIDC_ANALYTICS_EVENT_NAMES, DEFAULT_OIDC_ANALYTICS_EVENT_NAME_PREFIX, FIREBASE_SERVER_OIDC_ANALYTICS_CONFIG, type FirebaseServerOidcAnalyticsConfig } from './oidc.analytics.config';

/**
 * Reusable {@link OidcAnalyticsService} that forwards each high-level OIDC event to the app's
 * {@link FirebaseServerAnalyticsService}, so OIDC-transport analytics feed the same downstream
 * pipeline (e.g. Segment) as model and MCP analytics.
 *
 * Each {@link OidcAnalyticsEvent.type} resolves to a distinct downstream event name
 * (`eventNamePrefix` + per-type name, e.g. `'OIDC Login'`). Registered globally via
 * {@link appOidcAnalyticsModuleMetadata}; tuned via {@link FirebaseServerOidcAnalyticsConfig}.
 * When no analytics service is available the call is a no-op aside from the optional log line.
 */
@Injectable()
export class FirebaseServerOidcAnalyticsService extends OidcAnalyticsService {
  private readonly _logger = new Logger(FirebaseServerOidcAnalyticsService.name);

  private readonly _eventNamePrefix: string;
  private readonly _eventNames: Record<string, string>;
  private readonly _logEvents: boolean;

  constructor(
    @Inject(FirebaseServerEnvService) private readonly firebaseServerEnvService: FirebaseServerEnvService,
    @Optional() @Inject(FirebaseServerAnalyticsService) private readonly analyticsService?: FirebaseServerAnalyticsService,
    @Optional() @Inject(FIREBASE_SERVER_OIDC_ANALYTICS_CONFIG) config?: FirebaseServerOidcAnalyticsConfig
  ) {
    super();
    this._eventNamePrefix = config?.eventNamePrefix ?? DEFAULT_OIDC_ANALYTICS_EVENT_NAME_PREFIX;
    this._eventNames = { ...DEFAULT_OIDC_ANALYTICS_EVENT_NAMES, ...config?.eventNames };
    this._logEvents = config?.logEvents ?? !this.firebaseServerEnvService.isProduction;
  }

  handleOidcAnalyticsEvent(event: OidcAnalyticsEvent): void {
    const name = `${this._eventNamePrefix}${this._eventNames[event.type] ?? event.type}`;

    if (this._logEvents) {
      const uidSuffix = event.uid ? ` uid=${event.uid}` : '';
      const durationSuffix = event.durationMs == null ? '' : ` (${event.durationMs}ms)`;
      const outcome = event.isSuccessful ? 'Succeeded' : 'Failed';
      const reasonSuffix = event.reason ? ` reason=${event.reason}` : '';
      this._logger.log(`${name} ${outcome}${uidSuffix}${reasonSuffix}${durationSuffix}`);
    }

    if (this.analyticsService != null) {
      // Drop undefined values so the downstream payload stays clean.
      const data = filterUndefinedValues({
        clientId: event.clientId ?? undefined,
        scopes: event.scopes != null && event.scopes.length > 0 ? event.scopes.join(' ') : undefined,
        serviceToken: event.serviceToken ?? undefined,
        isAdmin: event.isAdmin ?? undefined,
        denied: event.denied ?? undefined,
        reason: event.reason ?? undefined,
        success: event.isSuccessful
      }) as AnalyticsEventData;

      this.analyticsService.sendEventData(event.uid, name, data);
    }
  }
}
