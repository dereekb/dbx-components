import { Observable, shareReplay } from 'rxjs';
import { ChangeDetectionStrategy, Component, Injector } from '@angular/core';
import { DbxInjectionArrayEntry } from '@dereekb/dbx-core';
import { DbxMapboxInjectionStore } from './mapbox.injection.store';

/**
 * Injects the components configured in the DbxMapboxInjectionStore into the view.
 */
@Component({
  selector: 'dbx-mapbox-injection',
  template: `
    <dbx-injection-array [entries]="entries$ | async"></dbx-injection-array>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DbxMapboxInjectionComponent {
  readonly entries$: Observable<DbxInjectionArrayEntry[]> = this.dbxMapboxMapKeyInjectionStore.allInjectionConfigs$.pipe(shareReplay(1));

  constructor(readonly dbxMapboxMapKeyInjectionStore: DbxMapboxInjectionStore, readonly injector: Injector) {}
}
