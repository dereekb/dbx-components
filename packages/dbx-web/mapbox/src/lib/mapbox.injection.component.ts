import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DbxInjectionArrayComponent } from '@dereekb/dbx-core';
import { DbxMapboxInjectionStore } from './mapbox.injection.store';
import { toSignal } from '@angular/core/rxjs-interop';

/**
 * Injects the components configured in the DbxMapboxInjectionStore into the view.
 */
@Component({
  selector: 'dbx-mapbox-injection',
  template: `
    <dbx-injection-array [entries]="entriesSignal()"></dbx-injection-array>
  `,
  imports: [DbxInjectionArrayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxMapboxInjectionComponent {
  readonly dbxMapboxMapKeyInjectionStore = inject(DbxMapboxInjectionStore);
  readonly entriesSignal = toSignal(this.dbxMapboxMapKeyInjectionStore.allInjectionConfigs$);
}
