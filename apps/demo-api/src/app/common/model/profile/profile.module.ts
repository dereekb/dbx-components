import { Module } from "@nestjs/common";
import { DemoFirebaseServerActionsContext } from "../../firebase/action.context";
import { AppActionModule } from "../../firebase/action.module";
import { profileServerActions, ProfileServerActions } from "./profile.action.server";

export const profileServerActionsFactory = (context: DemoFirebaseServerActionsContext) => profileServerActions(context)

@Module({
  imports: [AppActionModule],
  providers: [{
    provide: ProfileServerActions,
    useFactory: profileServerActionsFactory,
    inject: [DemoFirebaseServerActionsContext]
  }]
})
export class ProfileModule { }
