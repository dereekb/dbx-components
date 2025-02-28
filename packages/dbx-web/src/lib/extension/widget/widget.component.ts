import { Observable, BehaviorSubject, map, shareReplay, distinctUntilChanged } from 'rxjs';
import { Component, Input, OnDestroy, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';
import { DbxInjectionComponentConfig } from '@dereekb/dbx-core';
import { DbxWidgetViewComponentConfig } from './widget';
import { DbxWidgetService } from './widget.service';

/**
 * Used to display a corresponding widget based on the input data.
 */
@Component({
  selector: 'dbx-widget-view',
  template: `
    <ng-container [ngSwitch]="widgetConfigExists$ | async">
      <ng-container *ngSwitchCase="true">
        <ng-container *ngTemplateOutlet="widget"></ng-container>
      </ng-container>
      <ng-container *ngSwitchCase="false">
        <ng-container *ngTemplateOutlet="unknown"></ng-container>
      </ng-container>
    </ng-container>
    <ng-template #widget>
      <dbx-injection [config]="config$ | async"></dbx-injection>
    </ng-template>
    <ng-template #unknown>
      <ng-content empty select="[unknownWidget]"></ng-content>
    </ng-template>
  `,
  host: {
    class: 'dbx-widget-view'
  }
})
export class DbxWidgetViewComponent implements OnDestroy {
  readonly dbxWidgetService = inject(DbxWidgetService);

  private readonly _config = new BehaviorSubject<Maybe<DbxWidgetViewComponentConfig>>(undefined);

  readonly config$: Observable<Maybe<DbxInjectionComponentConfig>> = this._config.pipe(
    map((pair: Maybe<DbxWidgetViewComponentConfig>) => {
      let config: Maybe<DbxInjectionComponentConfig> = undefined;

      if (pair != null) {
        let entry = this.dbxWidgetService.getWidgetEntry(pair.type);

        if (!entry && pair.defaultType) {
          entry = this.dbxWidgetService.getWidgetEntry(pair.defaultType);
        }

        if (entry) {
          config = {
            componentClass: entry.componentClass,
            data: pair.data
          };
        } else {
          config = null;
        }
      }

      return config;
    }),
    shareReplay(1)
  );

  readonly widgetConfigExists$ = this.config$.pipe(
    map((x) => x !== null),
    distinctUntilChanged(),
    shareReplay(1)
  );

  ngOnDestroy(): void {
    this._config.complete();
  }

  @Input()
  set config(config: Maybe<DbxWidgetViewComponentConfig>) {
    this._config.next(config);
  }
}
