import { DocTextLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.text.router';
import { DocSharedModule } from '../shared/doc.shared.module';

@NgModule({
  imports: [
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [DocTextLayoutComponent]
})
export class DocTextModule {}
