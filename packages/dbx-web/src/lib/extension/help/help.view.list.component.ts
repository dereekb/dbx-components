import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { DbxHelpContextString } from './help';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { asObservable, distinctUntilHasDifferentValues, ObservableOrValue } from '@dereekb/rxjs';
import { map, Observable, of, shareReplay, switchMap } from 'rxjs';
import { DbxHelpWidgetService } from './help.widget.service';
import { DbxHelpViewListEntryComponent } from './help.view.list.entry.component';
import { ArrayOrValue, asArray } from '@dereekb/util';
import { MatAccordion } from '@angular/material/expansion';
import { DbxListEmptyContentComponent } from '../../layout/list/list.content.empty.component';

@Component({
  selector: 'dbx-help-view-list',
  template: `
    <mat-accordion [multi]="multi()">
      @for (widgetEntry of helpWidgetEntriesSignal(); track widgetEntry.helpContextString) {
        <dbx-help-view-list-entry [helpWidgetEntry]="widgetEntry"></dbx-help-view-list-entry>
      }
    </mat-accordion>
    @if (hasNoHelpWidgetEntriesSignal()) {
      <dbx-list-empty-content>
        <ng-content select="[empty]"></ng-content>
      </dbx-list-empty-content>
    }
  `,
  host: {
    class: 'dbx-help-view-list dbx-block'
  },
  imports: [MatAccordion, DbxHelpViewListEntryComponent, DbxListEmptyContentComponent],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxHelpViewListComponent {
  readonly helpWidgetService = inject(DbxHelpWidgetService);

  /**
   * Whether the accordion should allow multiple expanded panels.
   */
  readonly multi = input<boolean>(true);

  readonly helpContextStrings = input.required<ObservableOrValue<ArrayOrValue<DbxHelpContextString>>>();
  readonly helpContextStrings$: Observable<DbxHelpContextString[]> = toObservable(this.helpContextStrings).pipe(
    switchMap((x) => asObservable(x) ?? of([])),
    map(asArray),
    distinctUntilHasDifferentValues(),
    shareReplay(1)
  );

  readonly helpContextStringsSignal = toSignal(this.helpContextStrings$, { initialValue: [] });
  readonly helpWidgetEntriesSignal = computed(() => this.helpWidgetService.getHelpWidgetEntriesForHelpContextStrings(this.helpContextStringsSignal()));

  readonly hasNoHelpWidgetEntriesSignal = computed(() => !this.helpWidgetEntriesSignal()?.length);
}
