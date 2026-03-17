/**
 * Application context included in Segment event contexts.
 */
export interface SegmentServiceAppContext {
  readonly name: string;
  readonly version?: string;
  readonly namespace?: string;
}

/**
 * Configuration for the Segment analytics service.
 */
export class SegmentServiceConfig {
  /**
   * Segment write key for the source.
   */
  readonly writeKey!: string;

  /**
   * When true, events are logged to the console instead of sent to Segment.
   */
  readonly logOnly!: boolean;

  /**
   * Optional application context included in all Segment event contexts.
   */
  readonly appContext?: SegmentServiceAppContext;

  static assertValidConfig(config: SegmentServiceConfig): void {
    if (!config.writeKey) {
      throw new Error('No Segment write key specified.');
    }
  }
}
