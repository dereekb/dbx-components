import { Module } from "@nestjs/common";
import { DemoFirebaseServerActionsContext } from "../../firebase/action.context";
import { DemoApiActionModule } from "../../firebase/action.module";
import { profileServerActions, ProfileServerActions } from "./profile.action.server";

export const profileServerActionsFactory = (context: DemoFirebaseServerActionsContext) => profileServerActions(context)

@Module({
  imports: [DemoApiActionModule],
  providers: [{
    provide: ProfileServerActions,
    useFactory: profileServerActionsFactory,
    inject: [DemoFirebaseServerActionsContext]
  }],
  exports: [ProfileServerActions]
})
export class ProfileModule { }
