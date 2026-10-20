import { Injectable, Logger, Optional, Inject } from '@nestjs/common';
import { type AnalyticsEventData } from '@dereekb/analytics';
import { FirebaseServerAnalyticsService, FirebaseServerEnvService } from '@dereekb/firebase-server';
import { type Maybe } from '@dereekb/util';
import { McpAnalyticsService, type McpAnalyticsEvent } from './mcp.analytics.handler';
import { DEFAULT_MCP_ANALYTICS_EVENT_NAME, FIREBASE_SERVER_MCP_ANALYTICS_CONFIG, type FirebaseServerMcpAnalyticsConfig } from './mcp.analytics.config';
import { findMcpToolAnalyticsConfig, type McpToolAnalyticsConfig, type McpToolAnalyticsConfigs, type McpToolAnalyticsEmitter } from './mcp.analytics.tool';

/**
 * Reusable {@link McpAnalyticsService} that forwards each completed MCP tool call to the app's
 * {@link FirebaseServerAnalyticsService}, so MCP-transport analytics feed the same downstream
 * pipeline (e.g. Segment) as model analytics.
 *
 * Registered globally via {@link appMcpAnalyticsModuleMetadata}; tuned via
 * {@link FirebaseServerMcpAnalyticsConfig}. Per-tool configs ({@link FirebaseServerMcpAnalyticsConfig.tools}) can turn
 * off the default event, change its data, or send extra events. When no analytics service is available the call is a
 * no-op aside from the optional log line.
 */
@Injectable()
export class FirebaseServerMcpAnalyticsService extends McpAnalyticsService {
  private readonly _logger = new Logger(FirebaseServerMcpAnalyticsService.name);

  private readonly _eventName: string;
  private readonly _logEvents: boolean;
  private readonly _tools: Maybe<McpToolAnalyticsConfigs>;

  constructor(
    @Inject(FirebaseServerEnvService) private readonly firebaseServerEnvService: FirebaseServerEnvService,
    @Optional() @Inject(FirebaseServerAnalyticsService) private readonly analyticsService?: FirebaseServerAnalyticsService,
    @Optional() @Inject(FIREBASE_SERVER_MCP_ANALYTICS_CONFIG) config?: FirebaseServerMcpAnalyticsConfig
  ) {
    super();
    this._eventName = config?.eventName ?? DEFAULT_MCP_ANALYTICS_EVENT_NAME;
    this._logEvents = config?.logEvents ?? !this.firebaseServerEnvService.isProduction;
    this._tools = config?.tools;
  }

  handleMcpAnalyticsEvent(event: McpAnalyticsEvent): void {
    const toolConfig = findMcpToolAnalyticsConfig(this._tools, event);
    const sendDefaultEvent = toolConfig?.sendDefaultEvent !== false;
    const sentEventNames: string[] = [];
    const analyticsService = this.analyticsService;

    if (analyticsService != null) {
      if (sendDefaultEvent) {
        analyticsService.sendEventData(event.uid, this._eventName, this._defaultEventData(event, toolConfig));
      }

      if (toolConfig?.onComplete != null) {
        const emitter: McpToolAnalyticsEmitter = {
          sendEvent: (name, data) => {
            analyticsService.sendEventData(event.uid, name, data ?? {});
            sentEventNames.push(name);
          }
        };

        try {
          toolConfig.onComplete(emitter, event);
        } catch (e) {
          this._logger.warn(`MCP analytics onComplete for ${event.method ?? event.toolName} threw; events it sent before throwing were kept.`, e);
        }
      }
    }

    if (this._logEvents) {
      const uidSuffix = event.uid ? ` uid=${event.uid}` : '';
      const durationSuffix = event.durationMs == null ? '' : ` (${event.durationMs}ms)`;
      const reasonSuffix = event.reason ? ` reason="${event.reason}"` : '';
      const outcome = event.isSuccessful ? 'Succeeded' : 'Failed';
      const methodSuffix = event.method ? ` method=${event.method}` : '';
      const defaultOffSuffix = sendDefaultEvent ? '' : ' (default event off)';
      const sentSuffix = sentEventNames.length > 0 ? ` sent: ${sentEventNames.join(', ')}` : '';
      this._logger.log(`MCP ${event.toolName} [${event.toolKind}]${methodSuffix} ${outcome}${uidSuffix}${durationSuffix}${reasonSuffix}${defaultOffSuffix}${sentSuffix}`);
    }
  }

  /**
   * Builds the default event's data, then applies the tool's {@link McpToolAnalyticsConfig.defaultEventData}. When that
   * function throws, the unchanged default data is sent and a warning is logged.
   *
   * @param event - The completed call's event.
   * @param toolConfig - The tool's analytics config, if any.
   * @returns The data to send with the default event.
   */
  private _defaultEventData(event: McpAnalyticsEvent, toolConfig: Maybe<McpToolAnalyticsConfig>): AnalyticsEventData {
    const data: AnalyticsEventData = {
      tool: event.toolName,
      toolKind: event.toolKind,
      call: event.call ?? '',
      modelType: event.modelType ?? '',
      specifier: event.specifier ?? '',
      method: event.method ?? '',
      routed: event.routed === true,
      success: event.isSuccessful,
      reason: event.reason ?? ''
    };

    const defaultEventData = toolConfig?.defaultEventData;
    let result: AnalyticsEventData = data;

    if (typeof defaultEventData === 'function') {
      try {
        result = defaultEventData(data, event);
      } catch (e) {
        this._logger.warn(`MCP analytics defaultEventData for ${event.method ?? event.toolName} threw; sending the default data unchanged.`, e);
      }
    } else if (defaultEventData != null) {
      result = { ...data, ...defaultEventData };
    }

    return result;
  }
}
