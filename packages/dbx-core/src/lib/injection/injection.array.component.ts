import { BehaviorSubject } from 'rxjs';
import { ChangeDetectionStrategy, Component, input, Input, OnDestroy, TrackByFunction } from '@angular/core';
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
    @for (entry of entries(); track entry.key) {
      <dbx-injection [config]="entry.injectionConfig"></dbx-injection>
    }
  `,
  imports: [DbxInjectionComponent, NgFor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxInjectionArrayComponent {
  readonly entries = input<Maybe<DbxInjectionArrayEntry[]>>(undefined);
}
