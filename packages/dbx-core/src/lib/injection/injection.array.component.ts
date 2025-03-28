import { BehaviorSubject } from 'rxjs';
import { ChangeDetectionStrategy, Component, Input, OnDestroy, TrackByFunction } from '@angular/core';
import { DbxInjectionArrayEntry } from './injection.array';
import { type Maybe } from '@dereekb/util';
import { DbxInjectionComponent } from './injection.component';
import { AsyncPipe, NgFor } from '@angular/common';
import { AsObservablePipe } from '../pipe/async/asobservable.pipe';

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
  imports: [DbxInjectionComponent, NgFor, AsObservablePipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxInjectionArrayComponent implements OnDestroy {
  private readonly _entries = new BehaviorSubject<DbxInjectionArrayEntry[]>([]);

  readonly entries$ = this._entries.asObservable();

  readonly trackByKeyFn: TrackByFunction<DbxInjectionArrayEntry> = (index, item) => item.key;

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
