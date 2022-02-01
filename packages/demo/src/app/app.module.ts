import { DbxSidenavModule } from '@dereekb/dbx-web';
import { AppLayoutComponent } from './container/layout.component';
import { NgModule } from '@angular/core';
import { UIRouterModule } from '@uirouter/angular';
import { AppSharedModule } from '@/shared/app.shared.module';
import { STATES } from './app.router';
import { CommonModule } from '@angular/common';

@NgModule({
  imports: [
    CommonModule,
    AppSharedModule,
    UIRouterModule.forChild({
      states: STATES
    })
  ],
  declarations: [AppLayoutComponent],
})
export class AppModule { }
