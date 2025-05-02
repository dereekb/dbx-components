import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.layout.router';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    })
  ]
})
export class DocLayoutModule {}
