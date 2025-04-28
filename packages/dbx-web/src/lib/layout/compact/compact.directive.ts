import { Directive, Input, effect, inject, input } from '@angular/core';
import { CompactMode } from './compact';
import { CompactContextStore } from './compact.store';
import { Maybe } from '@dereekb/util';

/**
 * CompactContextStore provider.
 */
@Directive({
  selector: '[dbxCompact]',
  providers: [CompactContextStore],
  exportAs: 'compact',
  standalone: true
})
export class DbxCompactDirective {
  readonly mode = input.required<CompactMode | boolean>({ alias: 'dbxCompact' });

  readonly compactContextStore = inject(CompactContextStore);
  readonly mode$ = this.compactContextStore.mode$;

  protected readonly modeEffect = effect(() => {
    this.compactContextStore.setMode(this.mode());
  });
}
