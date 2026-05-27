import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { FirebaseServerAnalyticsService } from '@dereekb/firebase-server';
import { McpAnalyticsService, type McpAnalyticsEvent } from './mcp.analytics.handler';
import { DEFAULT_MCP_ANALYTICS_EVENT_NAME, FIREBASE_SERVER_MCP_ANALYTICS_CONFIG, type FirebaseServerMcpAnalyticsConfig } from './mcp.analytics.config';

/**
 * Reusable {@link McpAnalyticsService} that forwards each completed MCP tool call to the app's
 * {@link FirebaseServerAnalyticsService}, so MCP-transport analytics feed the same downstream
 * pipeline (e.g. Segment) as model analytics.
 *
 * Registered globally via {@link appMcpAnalyticsModuleMetadata}; tuned via
 * {@link FirebaseServerMcpAnalyticsConfig}. When no analytics service is available the call is a
 * no-op aside from the optional log line.
 */
@Injectable()
export class FirebaseServerMcpAnalyticsService extends McpAnalyticsService {
  private readonly _logger = new Logger(FirebaseServerMcpAnalyticsService.name);
  private readonly _eventName: string;
  private readonly _logEvents: boolean;

  constructor(
    @Optional() @Inject(FirebaseServerAnalyticsService) private readonly analyticsService?: FirebaseServerAnalyticsService,
    @Optional() @Inject(FIREBASE_SERVER_MCP_ANALYTICS_CONFIG) config?: FirebaseServerMcpAnalyticsConfig
  ) {
    super();
    this._eventName = config?.eventName ?? DEFAULT_MCP_ANALYTICS_EVENT_NAME;
    this._logEvents = config?.logEvents ?? true;
  }

  handleMcpAnalyticsEvent(event: McpAnalyticsEvent): void {
    if (this._logEvents) {
      const uidSuffix = event.uid ? ` uid=${event.uid}` : '';
      const durationSuffix = event.durationMs != null ? ` (${event.durationMs}ms)` : '';
      const outcome = event.isSuccessful ? 'Succeeded' : 'Failed';
      this._logger.log(`MCP ${event.toolName} [${event.toolKind}] ${outcome}${uidSuffix}${durationSuffix}`);
    }

    if (this.analyticsService != null) {
      this.analyticsService.sendEventData(event.uid, this._eventName, {
        tool: event.toolName,
        toolKind: event.toolKind,
        call: event.call ?? '',
        modelType: event.modelType ?? '',
        specifier: event.specifier ?? '',
        success: event.isSuccessful
      });
    }
  }
}
