import { Module } from "@nestjs/common";
import { DemoFirebaseServerActionsContext, DemoApiActionModule } from "../../firebase";
import { guestbookServerActions, GuestbookServerActions } from "./guestbook.action.server";

export const guestbookServerActionsFactory = (context: DemoFirebaseServerActionsContext) => guestbookServerActions(context)

@Module({
  imports: [DemoApiActionModule],
  providers: [{
    provide: GuestbookServerActions,
    useFactory: guestbookServerActionsFactory,
    inject: [DemoFirebaseServerActionsContext]
  }],
  exports: [GuestbookServerActions]
})
export class GuestbookModule { }
