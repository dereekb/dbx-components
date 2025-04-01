import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { APP_INITIALIZER, EnvironmentProviders, ModuleWithProviders, NgModule, Provider, inject, makeEnvironmentProviders } from '@angular/core';
import { DbxInjectionComponentModule } from '@dereekb/dbx-core';
import { DbxActionModule, DbxRouterAnchorModule, DbxButtonModule, DbxReadableErrorModule, DbxPopupInteractionModule, DbxTwoColumnLayoutModule, DbxBlockLayoutModule, DbxWidgetModule, DbxListLayoutModule, DbxTextModule } from '@dereekb/dbx-web';
import { DbxFirebaseDevelopmentWidgetService, DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN } from './development.widget.service';
import { DbxFormActionModule, DbxFormFormlyTextFieldModule, DbxFormIoModule, DbxFormlyModule, DbxFormModule } from '@dereekb/dbx-form';
import { DbxFirebaseDevelopmentPopupComponent } from './development.popup.component';
import { DbxFirebaseDevelopmentPopupContentComponent } from './development.popup.content.component';
import { DbxFirebaseDevelopmentDirective } from './development.popup.directive';
import { DbxFirebaseDevelopmentService, DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN } from './development.service';
import { DbxFirebaseDevelopmentPopupContentFormComponent } from './development.popup.content.form.component';
import { DbxFirebaseDevelopmentSchedulerService } from './development.scheduler.service';
import { DbxFirebaseDevelopmentWidgetEntry } from './development.widget';
import { DbxFirebaseDevelopmentSchedulerListComponent, DbxFirebaseDevelopmentSchedulerListViewComponent, DbxFirebaseDevelopmentSchedulerListViewItemComponent } from './development.scheduler.list.component';
import { DbxFirebaseDevelopmentSchedulerWidgetComponent, developmentFirebaseServerSchedulerWidgetEntry } from './development.scheduler.widget.component';

/**
 * Configuration for provideDbxFirebaseDevelopment().
 */
export interface ProvideDbxFirebaseDevelopmentConfig {
  /**
   * Whether or not to automatically add the developmentFirebaseServerSchedulerWidgetEntry() to the developmentWidgetEntries.
   *
   * Defaults to true.
   */
  readonly addDevelopmentSchedulerWidget?: boolean;
  /**
   * Widgets to add to the DbxFirebaseDevelopmentWidgetService module.
   *
   * Configured via the DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN.
   */
  readonly developmentWidgetEntries?: DbxFirebaseDevelopmentWidgetEntry[];
  /**
   * Whether or not the development module is currently enabled.
   *
   * Corresponds to DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN.
   */
  readonly enabled?: boolean;
}

/**
 * Creates providers for DbxFirebaseDevelopmentSchedulerService, DbxFirebaseDevelopmentWidgetService, and DbxFirebaseDevelopmentService.
 *
 * @param config
 * @returns
 */
export function provideDbxFirebaseDevelopment(config: ProvideDbxFirebaseDevelopmentConfig): EnvironmentProviders {
  const { developmentWidgetEntries: inputEntries, enabled, addDevelopmentSchedulerWidget } = config;
  const entries = [...(inputEntries ?? [])];

  if (addDevelopmentSchedulerWidget !== false) {
    entries.push(developmentFirebaseServerSchedulerWidgetEntry());
  }

  const providers: Provider[] = [
    // config
    {
      provide: DEFAULT_FIREBASE_DEVELOPMENT_WIDGET_PROVIDERS_TOKEN,
      useValue: entries
    },
    {
      provide: DEFAULT_FIREBASE_DEVELOPMENT_ENABLED_TOKEN,
      useValue: enabled
    },
    // services
    DbxFirebaseDevelopmentService,
    DbxFirebaseDevelopmentSchedulerService,
    DbxFirebaseDevelopmentWidgetService,
    // service initialization
    {
      provide: APP_INITIALIZER,
      useFactory: (scheduler: DbxFirebaseDevelopmentSchedulerService) => {
        return () => {
          // initialize the scheduler
          scheduler.init();
        };
      },
      deps: [DbxFirebaseDevelopmentSchedulerService],
      multi: true
    }
  ];

  return makeEnvironmentProviders(providers);
}
