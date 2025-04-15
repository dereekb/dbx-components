import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Maybe, ReadableError, ReadableErrorWithCode } from '@dereekb/util';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxErrorWidgetService } from './error.widget.service';

/**
 * Used to display a corresponding error widget based on the input data.
 */
@Component({
  selector: 'dbx-error-widget-view',
  template: `
    <dbx-injection [config]="errorWithCodeSignal()"></dbx-injection>
  `,
  host: {
    class: 'dbx-error-widget-view'
  },
  imports: [DbxInjectionComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxErrorWidgetViewComponent {
  readonly dbxErrorWidgetService = inject(DbxErrorWidgetService);

  readonly error = input<Maybe<ReadableError>>();

  readonly errorWithCodeSignal = computed<Maybe<DbxInjectionComponentConfig>>(() => {
    const currentError = this.error();
    const error: Maybe<ReadableErrorWithCode> = currentError && currentError.code ? (currentError as ReadableErrorWithCode) : undefined;

    let config: Maybe<DbxInjectionComponentConfig>;

    if (error != null) {
      const entry = this.dbxErrorWidgetService.getErrorWidgetEntry(error.code);

      if (entry != null) {
        const defaultEntry = this.dbxErrorWidgetService.getDefaultErrorWidgetEntry();
        const componentClass = entry.widgetComponentClass ?? defaultEntry?.widgetComponentClass;

        if (componentClass != null) {
          config = {
            componentClass,
            data: error
          };
        }
      } else {
        const unknownEntry = this.dbxErrorWidgetService.getUnknownErrorWidgetEntry();

        if (unknownEntry?.widgetComponentClass != null) {
          config = {
            componentClass: unknownEntry?.widgetComponentClass,
            data: error
          };
        }
      }
    }

    return config;
  });
}
