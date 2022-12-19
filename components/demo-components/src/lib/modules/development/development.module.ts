import { NgModule } from '@angular/core';
import { DemoRootSharedModule } from '../../root.shared.module';
import { DemoSetupDevelopmentWidgetComponent } from './setup.widget.component';

@NgModule({
  imports: [DemoRootSharedModule],
  declarations: [DemoSetupDevelopmentWidgetComponent],
  exports: [DemoSetupDevelopmentWidgetComponent]
})
export class DemoSharedDevelopmentModule {}
