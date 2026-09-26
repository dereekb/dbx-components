import { Component, inject } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FilterSource } from '@dereekb/rxjs';
import { type DocInteractionTestMergedFilter } from './filter';

/**
 * Displays the value of the injected FilterSource.
 *
 * Stands in for a list that reads its filter from DI, e.g. from a parent [dbxFilterMapMergeSource].
 */
@Component({
  selector: 'doc-interaction-test-merged-filter-view',
  template: `
    <p>Injected FilterSource Value: {{ filterSignal() | json }}</p>
  `,
  imports: [JsonPipe]
})
export class DocInteractionTestMergedFilterViewComponent {
  readonly filterSource = inject(FilterSource<DocInteractionTestMergedFilter>);
  readonly filterSignal = toSignal(this.filterSource.filter$);
}
