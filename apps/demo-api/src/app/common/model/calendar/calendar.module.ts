import { Module } from '@nestjs/common';
import { type ICalendarOrganizer } from '@dereekb/date';
import { appCalendarModuleMetadata, BASE_CALENDAR_SERVER_ACTION_CONTEXT_TOKEN } from '@dereekb/firebase-server/model';
import { DEMO_CALENDAR_TYPE_CONFIGS } from 'demo-firebase';
import { DemoFirebaseServerActionsContext } from '../../firebase/action.context';
import { DemoApiActionModule } from '../../firebase/action.module';
import { StorageFileModule } from '../storagefile/storagefile.module';

/**
 * The domain every generated event UID is suffixed with.
 *
 * A UID must be stable across publishes — a changing one makes a client create a duplicate event rather
 * than update the one it holds — so this is a fixed constant rather than anything derived at runtime.
 */
export const DEMO_CALENDAR_ICS_DOMAIN = 'dereekb.com';

/**
 * The ORGANIZER every emailed calendar invite is sent as.
 *
 * Points at an UNMONITORED mailbox on purpose. We are the organizer, so a client is free to send us an
 * inbound `METHOD:REPLY` even though every attendee is invited with `RSVP=FALSE` -- and until RSVP is
 * genuinely handled, those replies should land somewhere that archives or discards them rather than in a
 * human's inbox.
 */
export const DEMO_CALENDAR_INVITE_ORGANIZER: ICalendarOrganizer = {
  name: 'Example Calendar',
  address: 'calendar-invites@components.dereekb.com'
};

/**
 * Dependencies for the CalendarModule.
 */
@Module({
  imports: [DemoApiActionModule, StorageFileModule],
  providers: [
    {
      provide: BASE_CALENDAR_SERVER_ACTION_CONTEXT_TOKEN,
      useExisting: DemoFirebaseServerActionsContext
    }
  ],
  exports: [DemoApiActionModule, StorageFileModule, BASE_CALENDAR_SERVER_ACTION_CONTEXT_TOKEN]
})
export class CalendarDependencyModule {}

/**
 * Calendar model module.
 */
@Module(
  appCalendarModuleMetadata({
    dependencyModule: CalendarDependencyModule,
    calendarTypeConfigs: DEMO_CALENDAR_TYPE_CONFIGS,
    icsDomain: DEMO_CALENDAR_ICS_DOMAIN
  })
)
export class CalendarModule {}
