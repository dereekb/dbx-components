import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
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

  private readonly _errorWithCodeSignal = signal<Maybe<ReadableErrorWithCode>>(undefined);
  readonly errorWithCodeSignal = computed<Maybe<DbxInjectionComponentConfig>>(() => {
    const error: Maybe<ReadableErrorWithCode> = this._errorWithCodeSignal();

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

  readonly error = input<Maybe<ReadableError>>();

  constructor() {
    // Set up effect to update the error code signal when the input changes
    effect(() => {
      const error = this.error();
      this._errorWithCodeSignal.set(error && error.code ? (error as ReadableErrorWithCode) : undefined);
    });
  }
}
