import { Observable, BehaviorSubject, map } from 'rxjs';
import { Component, Input, OnDestroy } from '@angular/core';
import { Maybe, ReadableError, ReadableErrorWithCode } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxErrorWidgetService } from './error.widget.service';

/**
 * Used to display a corresponding error widget based on the input data.
 */
@Component({
  selector: 'dbx-error-widget-view',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  host: {
    class: 'dbx-error-widget-view'
  }
})
export class DbxErrorWidgetViewComponent implements OnDestroy {
  private _errorWithCode = new BehaviorSubject<Maybe<ReadableErrorWithCode>>(undefined);

  readonly config$: Observable<Maybe<DbxInjectionComponentConfig>> = this._errorWithCode.pipe(
    map((error: Maybe<ReadableErrorWithCode>) => {
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
    })
  );

  constructor(readonly dbxErrorWidgetService: DbxErrorWidgetService) {}

  ngOnDestroy(): void {
    this._errorWithCode.complete();
  }

  @Input()
  set error(error: Maybe<ReadableError>) {
    const config = error && error.code ? (error as ReadableErrorWithCode) : undefined;
    this._errorWithCode.next(config);
  }
}
