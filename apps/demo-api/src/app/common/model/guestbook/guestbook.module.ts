import { Module } from "@nestjs/common";
import { DemoFirebaseServerActionsContext } from "../../firebase/action.context";
import { AppActionModule } from "../../firebase/action.module";
import { guestbookServerActions, GuestbookServerActions } from "./guestbook.action.server";

export const guestbookServerActionsFactory = (context: DemoFirebaseServerActionsContext) => guestbookServerActions(context)

@Module({
  imports: [AppActionModule],
  providers: [{
    provide: GuestbookServerActions,
    useFactory: guestbookServerActionsFactory,
    inject: [DemoFirebaseServerActionsContext]
  }],
  exports: [GuestbookServerActions]
})
export class GuestbookModule { }
