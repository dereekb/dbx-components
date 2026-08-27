import { Module } from '@nestjs/common';
import { DemoFirebaseServerActionsContext, DemoApiActionModule } from '../../firebase';
import { profileServerActions, ProfileServerActions } from './profile.action.server';

export const profileServerActionsFactory = (context: DemoFirebaseServerActionsContext) => profileServerActions(context);

@Module({
  imports: [DemoApiActionModule],
  providers: [
    {
      provide: ProfileServerActions,
      useFactory: profileServerActionsFactory,
      inject: [DemoFirebaseServerActionsContext]
    }
  ],
  exports: [ProfileServerActions]
})
export class ProfileModule {}
