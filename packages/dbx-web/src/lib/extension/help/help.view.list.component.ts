import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DbxHelpContextKey } from './help';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { asObservable, distinctUntilHasDifferentValues, ObservableOrValue } from '@dereekb/rxjs';
import { map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { DbxHelpWidgetService } from './help.widget.service';
import { DbxHelpViewListEntryComponent } from './help.view.list.entry.component';
import { ArrayOrValue, asArray, Maybe, sortByNumberFunction } from '@dereekb/util';
import { MatAccordion } from '@angular/material/expansion';
import { DbxListEmptyContentComponent } from '../../layout/list/list.content.empty.component';
import { DbxInjectionComponent, DbxInjectionComponentConfig } from '@dereekb/dbx-core';

@Component({
  selector: 'dbx-help-view-list',
  template: `
    <div class="dbx-help-view-list-header">
      <dbx-injection [config]="helpListHeaderComponentConfigSignal()"></dbx-injection>
    </div>
    <mat-accordion [multi]="multi()">
      @for (widgetEntry of helpWidgetEntriesSignal(); track widgetEntry.helpContextKey) {
        <dbx-help-view-list-entry [helpWidgetEntry]="widgetEntry"></dbx-help-view-list-entry>
      }
    </mat-accordion>
    @if (hasNoHelpWidgetEntriesSignal()) {
      <dbx-list-empty-content>
        <ng-content select="[empty]"></ng-content>
      </dbx-list-empty-content>
    }
    <div class="dbx-help-view-list-footer">
      <dbx-injection [config]="helpListFooterComponentConfigSignal()"></dbx-injection>
    </div>
  `,
  host: {
    class: 'dbx-help-view-list dbx-block'
  },
  imports: [MatAccordion, DbxHelpViewListEntryComponent, DbxListEmptyContentComponent, DbxInjectionComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxHelpViewListComponent {
  readonly helpWidgetService = inject(DbxHelpWidgetService);

  /**
   * Whether the accordion should allow multiple expanded panels.
   */
  readonly multi = input<Maybe<boolean>>();

  /**
   * Whether or not to show the empty list content.
   */
  readonly allowEmptyListContent = input<boolean>(true);

  /**
   * Optional header component config to inject before the list.
   *
   * If set null, then will not show any header.
   */
  readonly helpListHeaderComponentConfig = input<Maybe<DbxInjectionComponentConfig>>(undefined);

  /**
   * Optional header component config to inject before the list.
   *
   * If set null, then will not show any header.
   */
  readonly helpListFooterComponentConfig = input<Maybe<DbxInjectionComponentConfig>>(undefined);

  readonly helpContextKeys = input.required<ObservableOrValue<ArrayOrValue<DbxHelpContextKey>>>();
  readonly helpContextKeys$: Observable<DbxHelpContextKey[]> = toObservable(this.helpContextKeys).pipe(
    switchMap((x) => asObservable(x) ?? of([])),
    map(asArray),
    distinctUntilHasDifferentValues(),
    map((x) => {
      const sortPriorityMap = this.helpWidgetService.getSortPriorityMap();
      const sorted = [...x].sort(sortByNumberFunction((x) => sortPriorityMap.get(x) ?? -2));
      return sorted;
    }),
    shareReplay(1)
  );

  readonly helpContextKeysSignal = toSignal(this.helpContextKeys$, { initialValue: [] });
  readonly helpWidgetEntriesSignal = computed(() => this.helpWidgetService.getHelpWidgetEntriesForHelpContextKeys(this.helpContextKeysSignal()));

  readonly hasNoHelpWidgetEntriesSignal = computed(() => !this.helpWidgetEntriesSignal()?.length);

  readonly helpListHeaderComponentConfigSignal = computed(() => {
    let config: Maybe<DbxInjectionComponentConfig> = this.helpListHeaderComponentConfig();

    if (config !== null) {
      config = this.helpWidgetService.getHelpListHeaderComponentConfig();
    }

    return config;
  });

  readonly helpListFooterComponentConfigSignal = computed(() => {
    let config: Maybe<DbxInjectionComponentConfig> = this.helpListFooterComponentConfig();

    if (config !== null) {
      config = this.helpWidgetService.getHelpListFooterComponentConfig();
    }

    return config;
  });
}
