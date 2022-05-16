import { DemoSharedModule } from "@/shared/shared.module";
import { NgModule } from "@angular/core";
import { UIRouterModule } from "@uirouter/angular";
import { DemoOnboardLayoutComponent } from "./container/layout.component";
import { DemoOnboardTosComponent } from "./container/tos.component";
import { DemoOnboardUserComponent } from "./container/user.component";
import { DEMO_ONBOARD_STATES } from "./demo.onboard.router";


@NgModule({
  imports: [
    DemoSharedModule,
    UIRouterModule.forChild({
      states: DEMO_ONBOARD_STATES
    })
  ],
  declarations: [
    // components
    // container
    DemoOnboardLayoutComponent,
    DemoOnboardTosComponent,
    DemoOnboardUserComponent
  ],
})
export class DemoOnboardModule { }
