import { DocRouterLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocRouterAnchorComponent } from './container/anchor.component';
import { DocRouterAnchorListComponent } from './container/anchorlist.component';
import { DocRouterHomeComponent } from './container/home.component';

import { DocRouterNavbarComponent } from './container/navbar.component';
import { STATES } from './doc.router.router';
import { DocRouterCustomAnchorContentComponent } from './component/anchor.content';
import { DocRouterNavbarAComponent } from './container/navbar.a.component';
import { DocRouterNavbarBComponent } from './container/navbar.b.component';

@NgModule({
  imports: [
    UIRouterModule.forChild({
      states: STATES
    }),
    //
    DocRouterCustomAnchorContentComponent,
    //
    DocRouterLayoutComponent,
    DocRouterHomeComponent,
    DocRouterAnchorComponent,
    DocRouterAnchorListComponent,
    DocRouterNavbarComponent,
    //
    DocRouterNavbarAComponent,
    DocRouterNavbarBComponent
  ]
})
export class DocRouterModule {}
