import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';

import { STATES } from './doc.action.router';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    })
  ]
})
export class DocActionModule {}
