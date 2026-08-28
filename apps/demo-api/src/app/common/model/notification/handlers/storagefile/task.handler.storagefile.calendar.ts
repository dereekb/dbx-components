import { type AppCalendarTypeConfigService, type CalendarFirestoreCollections, appCalendarTypeConfigService, calendarTypeConfigRecord, type FirebaseStorageAccessor } from '@dereekb/firebase';
import { calendarIcsStorageFileProcessingPurposeSubtaskProcessor, type StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget } from '@dereekb/firebase-server/model';
import { DEMO_CALENDAR_TYPE_CONFIGS } from 'demo-firebase';
import { DEMO_CALENDAR_ICS_DOMAIN } from '../../../calendar/calendar.module';

/**
 * Configuration for {@link demoCalendarIcsFileProcessingSubtaskProcessor}.
 */
export interface DemoCalendarIcsFileProcessingSubtaskProcessorConfig {
  readonly calendarFirestoreCollections: CalendarFirestoreCollections;
  readonly storageAccessor: FirebaseStorageAccessor;
  /**
   * The type registry the processor resolves each calendar's ICS config from.
   *
   * Built from {@link DEMO_CALENDAR_TYPE_CONFIGS} when absent, which keeps this processor out of the
   * NotificationModule → CalendarModule dependency edge for a registry that is a static constant anyway.
   */
  readonly appCalendarTypeConfigService?: AppCalendarTypeConfigService;
}

/**
 * Builds the `cal_ics` purpose's subtask processor for the demo app.
 *
 * A thin wrapper over the library processor, following the same convention as the `resume` handler: the
 * app supplies its own type registry and UID domain, the library owns the render-and-upload step.
 *
 * @param config - The calendar collections, storage accessor, and optional type registry.
 * @returns The subtask processor config targeting the Calendar ICS purpose.
 */
export function demoCalendarIcsFileProcessingSubtaskProcessor(config: DemoCalendarIcsFileProcessingSubtaskProcessorConfig): StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget {
  const { calendarFirestoreCollections, storageAccessor } = config;

  return calendarIcsStorageFileProcessingPurposeSubtaskProcessor({
    calendarFirestoreCollections,
    storageAccessor,
    appCalendarTypeConfigService: config.appCalendarTypeConfigService ?? appCalendarTypeConfigService(calendarTypeConfigRecord(DEMO_CALENDAR_TYPE_CONFIGS)),
    icsDomain: DEMO_CALENDAR_ICS_DOMAIN
  }) as StorageFileProcessingPurposeSubtaskProcessorConfigWithTarget;
}
