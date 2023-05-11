import { BehaviorSubject } from 'rxjs';
import { ChangeDetectionStrategy, Component, Input, OnDestroy, TrackByFunction } from '@angular/core';
import { DbxInjectionArrayEntry } from './injection.array';
import { Maybe } from '@dereekb/util';

/**
 * Component that injects content based on the configuration into the view.
 */
@Component({
  selector: 'dbx-injection-array',
  template: `
    <ng-container *ngFor="let entry of entries$ | async; trackBy: trackByKeyFn">
      <dbx-injection [config]="entry.injectionConfig | asObservable | async"></dbx-injection>
    </ng-container>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxInjectionArrayComponent implements OnDestroy {
  private _entries = new BehaviorSubject<DbxInjectionArrayEntry[]>([]);

  readonly entries$ = this._entries.asObservable();

  readonly trackByKeyFn: TrackByFunction<DbxInjectionArrayEntry> = (index, item) => item.key;

  constructor() {}

  ngOnDestroy(): void {
    this._entries.complete();
  }

  @Input()
  get entries(): DbxInjectionArrayEntry[] {
    return this._entries.getValue();
  }

  set entries(entries: Maybe<DbxInjectionArrayEntry[]>) {
    this._entries.next(entries || []);
  }
}
