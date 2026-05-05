import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.examples.router';

import { DocExamplesHomeComponent } from './container/home.component';
import { DocExamplesLayoutComponent } from './container/layout.component';
import { DocExamplesListComponent } from './container/list.component';
import { DocExamplesCardComponent } from './container/card.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    //
    DocExamplesHomeComponent,
    DocExamplesLayoutComponent,
    DocExamplesListComponent,
    DocExamplesCardComponent
  ]
})
export class DocExamplesModule {}
