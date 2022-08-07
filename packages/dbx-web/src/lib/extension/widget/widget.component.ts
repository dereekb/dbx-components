import { Observable, BehaviorSubject, map } from 'rxjs';
import { Component, Input, OnDestroy } from '@angular/core';
import { Maybe } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxWidgetDataPair } from './widget';
import { DbxWidgetService } from './widget.service';

/**
 * Used to display a corresponding widget based on the input data.
 */
@Component({
  selector: 'dbx-widget-view',
  template: `
    <dbx-injection [config]="config$ | async"></dbx-injection>
  `,
  host: {
    class: 'dbx-widget-view'
  }
})
export class DbxWidgetViewComponent implements OnDestroy {
  private _config = new BehaviorSubject<Maybe<DbxWidgetDataPair>>(undefined);

  readonly config$: Observable<Maybe<DbxInjectionComponentConfig>> = this._config.pipe(
    map((pair: Maybe<DbxWidgetDataPair>) => {
      let config: Maybe<DbxInjectionComponentConfig>;

      if (pair != null) {
        const entry = this.dbxWidgetService.getWidgetEntry(pair.type);

        if (entry) {
          config = {
            componentClass: entry.componentClass,
            data: pair.data
          };
        }
      }

      return config;
    })
  );

  constructor(readonly dbxWidgetService: DbxWidgetService) {}

  ngOnDestroy(): void {
    this._config.complete();
  }

  @Input()
  set config(config: Maybe<DbxWidgetDataPair>) {
    this._config.next(config);
  }
}
