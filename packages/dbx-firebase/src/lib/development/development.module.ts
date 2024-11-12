import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule, inject } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule, DbxRouterAnchorModule, DbxButtonModule, DbxReadableErrorModule, DbxPopupInteractionModule, DbxTwoColumnLayoutModule, DbxBlockLayoutModule, DbxWidgetModule, DbxListLayoutModule, DbxTextModule } from '@dereekb/dbx-web';
import { DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN } from './development.widget.service';
import { DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxFormIoModule, DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxFirebaseDevelopmentPopupComponent } from './development.popup.component';
import { DbxFirebaseDevelopmentPopupContentComponent } from './development.popup.content.component';
import { DbxFirebaseDevelopmentDirective } from './development.popup.directive';
import { DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN } from './development.service';
import { DbxFirebaseDevelopmentPopupContentFormComponent } from './development.popup.content.form.component';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { DbxFirebaseDevelopmentWidgetEntry } from './development.widget';
import { DbxFirebaseDevelopmentSchedulerListComponent, DbxFirebaseDevelopmentSchedulerListViewComponent, DbxFirebaseDevelopmentSchedulerListViewItemComponent } from './development.scheduler.list.component';
import { DbxFirebaseDevelopmentSchedulerWidgetComponent, developmentFirebaseServerSchedulerWidgetEntry } from './development.scheduler.widget.component';

export abstract class DbxFirebaseDevelopmentModuleRootConfig {
  abstract readonly enabled: boolean;
  abstract readonly entries: DbxFirebaseDevelopmentWidgetEntry[];
  abstract readonly addDevelopmentSchedulerWidget?: boolean;
}

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
export class DbxFirebaseDevelopmentModule {
  readonly dbxFirebaseDevelopmentSchedulerService = inject(DbxFirebaseDevelopmentSchedulerService);

  constructor() {
    this.dbxFirebaseDevelopmentSchedulerService.init();
  }

  static forRoot(config: DbxFirebaseDevelopmentModuleRootConfig): ModuleWithProviders<DbxFirebaseDevelopmentModule> {
    let entries = config.entries;

    if (config.addDevelopmentSchedulerWidget !== false) {
      entries = [developmentFirebaseServerSchedulerWidgetEntry(), ...config.entries];
    }

    return {
      ngModule: DbxFirebaseDevelopmentModule,
      providers: [
        {
          provide: DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN,
          useValue: entries
        },
        {
          provide: DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN,
          useValue: config.enabled
        },
        {
          provide: DbxFirebaseDevelopmentModuleRootConfig,
          useValue: config
        }
      ]
    };
  }
}
