import { Module } from "@nestjs/common";
import { APP_CODE_PREFIXFirebaseServerActionsContext, APP_CODE_PREFIXApiActionModule } from "../../firebase";
import { exampleServerActions, ExampleServerActions } from "./example.action.server";

export const exampleServerActionsFactory = (context: APP_CODE_PREFIXFirebaseServerActionsContext) => exampleServerActions(context)

@Module({
  imports: [APP_CODE_PREFIXApiActionModule],
  providers: [{
    provide: ExampleServerActions,
    useFactory: exampleServerActionsFactory,
    inject: [APP_CODE_PREFIXFirebaseServerActionsContext]
  }],
  exports: [ExampleServerActions]
})
export class ExampleModule { }
