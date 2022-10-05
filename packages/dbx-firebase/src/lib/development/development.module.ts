import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { ModuleWithProviders, NgModule } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule, DbxRouterAnchorModule, DbxButtonModule, DbxReadableErrorModule, DbxPopupInteractionModule, DbxTwoColumnLayoutModule, DbxBlockLayoutModule, DbxWidgetModule } from '@dereekb/dbx-web';
import { DbxFirebaseDevelopmentWidgetEntry, DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN } from './development.widget.service';
import { DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxFormIoModule, DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxFirebaseDevelopmentPopupComponent } from './development.popup.component';
import { DbxFirebaseDevelopmentPopupContentComponent } from './development.popup.content.component';
import { DbxFirebaseDevelopmentDirective } from './development.popup.directive';
import { DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN } from './development.service';
import { DbxFirebaseDevelopmentPopupContentFormComponent } from './development.popup.content.form.component';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';

export abstract class DbxFirebaseDevelopmentModuleRootConfig {
  abstract readonly enabled: boolean;
  abstract readonly entries: DbxFirebaseDevelopmentWidgetEntry[];
}

/**
 * Contains components related to logging in.
 */
@NgModule({
  imports: [CommonModule, MatIconModule, DbxWidgetModule, DbxBlockLayoutModule, DbxTwoColumnLayoutModule, MatButtonModule, DbxRouterAnchorModule, DbxPopupInteractionModule, DbxFormIoModule, DbxFormModule, DbxFormlyModule, DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxReadableErrorModule, DbxActionModule, DbxButtonModule, DbxInjectionComponentModule],
  declarations: [DbxFirebaseDevelopmentPopupContentFormComponent, DbxFirebaseDevelopmentDirective, DbxFirebaseDevelopmentPopupComponent, DbxFirebaseDevelopmentPopupContentComponent],
  exports: [DbxFirebaseDevelopmentDirective, DbxFirebaseDevelopmentPopupComponent, DbxFirebaseDevelopmentPopupContentComponent]
})
export class DbxFirebaseDevelopmentModule {
  constructor(readonly dbxFirebaseDevelopmentSchedulerService: DbxFirebaseDevelopmentSchedulerService) {
    dbxFirebaseDevelopmentSchedulerService.init();
  }

  static forRoot(config: DbxFirebaseDevelopmentModuleRootConfig): ModuleWithProviders<DbxFirebaseDevelopmentModule> {
    return {
      ngModule: DbxFirebaseDevelopmentModule,
      providers: [
        {
          provide: DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN,
          useValue: config.entries
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
