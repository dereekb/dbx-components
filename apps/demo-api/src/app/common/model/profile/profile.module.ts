import { Module } from '@nestjs/common';
import { CalendarServerActions } from '@dereekb/firebase-server/model';
import { DemoFirebaseServerActionsContext, DemoApiActionModule } from '../../firebase';
import { CalendarModule } from '../calendar/calendar.module';
import { profileServerActions, ProfileServerActions } from './profile.action.server';

export const profileServerActionsFactory = (context: DemoFirebaseServerActionsContext, calendarServerActions: CalendarServerActions) => profileServerActions({ ...context, calendarServerActions });

@Module({
  imports: [DemoApiActionModule, CalendarModule],
  providers: [
    {
      provide: ProfileServerActions,
      useFactory: profileServerActionsFactory,
      inject: [DemoFirebaseServerActionsContext, CalendarServerActions]
    }
  ],
  exports: [ProfileServerActions]
})
export class ProfileModule {}
