import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule, DbxRouterAnchorModule, DbxButtonModule, DbxReadableErrorModule, DbxPopupInteractionModule, DbxTwoColumnLayoutModule, DbxBlockLayoutModule, DbxWidgetModule, DbxListLayoutModule, DbxTextModule } from '@dereekb/dbx-web';
import { DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxFormIoModule, DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxFirebaseDevelopmentPopupComponent } from './development.popup.component';
import { DbxFirebaseDevelopmentPopupContentComponent } from './development.popup.content.component';
import { DbxFirebaseDevelopmentDirective } from './development.directive';
import { DbxFirebaseDevelopmentPopupContentFormComponent } from './development.popup.content.form.component';
import { DbxFirebaseDevelopmentSchedulerListComponent, DbxFirebaseDevelopmentSchedulerListViewComponent, DbxFirebaseDevelopmentSchedulerListViewItemComponent } from './development.scheduler.list.component';
import { DbxFirebaseDevelopmentSchedulerWidgetComponent } from './development.scheduler.widget.component';

const importsAndExports = [
  //
  DbxFirebaseDevelopmentPopupContentFormComponent,
  DbxFirebaseDevelopmentDirective,
  DbxFirebaseDevelopmentPopupComponent,
  DbxFirebaseDevelopmentPopupContentComponent,
  DbxFirebaseDevelopmentSchedulerWidgetComponent,
  DbxFirebaseDevelopmentSchedulerListComponent,
  DbxFirebaseDevelopmentSchedulerListViewComponent,
  DbxFirebaseDevelopmentSchedulerListViewItemComponent
];
/**
 * Contains components related to logging in.
 */
@NgModule({
  imports: importsAndExports,
  exports: importsAndExports
})
export class DbxFirebaseDevelopmentModule {}
