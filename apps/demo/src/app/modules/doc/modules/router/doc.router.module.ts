import { DocRouterLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { DocRouterAnchorComponent } from './container/anchor.component';
import { DocRouterAnchorListComponent } from './container/anchorlist.component';
import { DocRouterHomeComponent } from './container/home.component';
import { DocSharedModule } from '../shared/doc.shared.module';
import { DocRouterNavbarComponent } from './container/navbar.component';
import { STATES } from './doc.router.router';
import { DocRouterCustomAnchorContentComponent } from './component/anchor.content';

@NgModule({
  imports: [
    DocSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    //
    DocRouterCustomAnchorContentComponent,
    //
    DocRouterLayoutComponent,
    DocRouterHomeComponent,
    DocRouterAnchorComponent,
    DocRouterAnchorListComponent,
    DocRouterNavbarComponent
  ]
})
export class DocRouterModule {}
