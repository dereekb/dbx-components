import { Module } from '@nestjs/common';
import { APP_CODE_PREFIXFirebaseServerActionsContext, APP_CODE_PREFIXApiActionModule } from '../../firebase';
import { profileServerActions, ProfileServerActions } from './profile.action.server';

export const profileServerActionsFactory = (context: APP_CODE_PREFIXFirebaseServerActionsContext) => profileServerActions(context);

@Module({
  imports: [APP_CODE_PREFIXApiActionModule],
  providers: [
    {
      provide: ProfileServerActions,
      useFactory: profileServerActionsFactory,
      inject: [APP_CODE_PREFIXFirebaseServerActionsContext]
    }
  ],
  exports: [ProfileServerActions]
})
export class ProfileModule {}
