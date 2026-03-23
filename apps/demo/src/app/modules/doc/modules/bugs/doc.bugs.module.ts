import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.bugs.router';

import { DocBugsHomeComponent } from './container/home.component';
import { DocBugsLayoutComponent } from './container/layout.component';
import { DocBugsFormsComponent } from './container/forms.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    //
    DocBugsHomeComponent,
    DocBugsLayoutComponent,
    DocBugsFormsComponent
  ]
})
export class DocBugsModule {}
