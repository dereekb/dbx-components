import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule, DbxRouterAnchorModule, DbxButtonModule, DbxReadableErrorModule, DbxPopupInteractionModule, DbxTwoColumnLayoutModule, DbxBlockLayoutModule, DbxWidgetModule, DbxListLayoutModule, DbxTextModule } from '@dereekb/dbx-web';
import { DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxFormIoModule, DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxFirebaseDevelopmentPopupComponent } from './development.popup.component';
import { DbxFirebaseDevelopmentPopupContentComponent } from './development.popup.content.component';
import { DbxFirebaseDevelopmentDirective } from './development.popup.directive';
import { DbxFirebaseDevelopmentPopupContentFormComponent } from './development.popup.content.form.component';
import { DbxFirebaseDevelopmentSchedulerListComponent, DbxFirebaseDevelopmentSchedulerListViewComponent, DbxFirebaseDevelopmentSchedulerListViewItemComponent } from './development.scheduler.list.component';
import { DbxFirebaseDevelopmentSchedulerWidgetComponent } from './development.scheduler.widget.component';

/**
 * Contains components related to logging in.
 */
@NgModule({
  imports: [CommonModule, MatIconModule, DbxWidgetModule, DbxTextModule, DbxBlockLayoutModule, DbxTwoColumnLayoutModule, MatButtonModule, DbxRouterAnchorModule, DbxPopupInteractionModule, DbxFormIoModule, DbxFormModule, DbxFormlyModule, DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxReadableErrorModule, DbxActionModule, DbxButtonModule, DbxInjectionComponentModule, DbxListLayoutModule],
  declarations: [
    //
    DbxFirebaseDevelopmentPopupContentFormComponent,
    DbxFirebaseDevelopmentDirective,
    DbxFirebaseDevelopmentPopupComponent,
    DbxFirebaseDevelopmentPopupContentComponent,
    DbxFirebaseDevelopmentSchedulerWidgetComponent,
    DbxFirebaseDevelopmentSchedulerListComponent,
    DbxFirebaseDevelopmentSchedulerListViewComponent,
    DbxFirebaseDevelopmentSchedulerListViewItemComponent
  ],
  exports: [
    //
    DbxFirebaseDevelopmentDirective,
    DbxFirebaseDevelopmentPopupComponent,
    DbxFirebaseDevelopmentPopupContentComponent,
    DbxFirebaseDevelopmentSchedulerWidgetComponent,
    DbxFirebaseDevelopmentSchedulerListComponent,
    DbxFirebaseDevelopmentSchedulerListViewComponent,
    DbxFirebaseDevelopmentSchedulerListViewItemComponent
  ]
})
export class DbxFirebaseDevelopmentModule {}
