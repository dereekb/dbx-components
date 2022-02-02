import { DocLayoutSectionComponent } from './container/section.component';
import { DocLayoutLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { STATES } from './doc.layout.router';
import { AppSharedModule } from '@/shared/app.shared.module';
import { DocLayoutHomeComponent } from './container/home.component';

@NgModule({
  imports: [
    AppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [
    DocLayoutLayoutComponent,
    DocLayoutHomeComponent,
    DocLayoutSectionComponent
  ],
})
export class DocLayoutModule { }
