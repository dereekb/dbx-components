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

  /**
   * Validates that the given config has the required fields (e.g., a non-empty write key).
   *
   * @param config - The config instance to validate.
   * @throws {Error} When the write key is missing or empty.
   *
   * @example
   * ```ts
   * SegmentServiceConfig.assertValidConfig(config);
   * ```
   */
  static assertValidConfig(config: SegmentServiceConfig): void {
    if (!config.writeKey) {
      throw new Error('No Segment write key specified.');
    }
  }
}
