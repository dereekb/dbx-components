import { Directive, Input, inject } from '@angular/core';
import { CompactMode } from './compact';
import { CompactContextStore } from './compact.store';

/**
 * CompactContextStore provider.
 */
@Directive({
  selector: '[dbxCompact]',
  providers: [CompactContextStore],
  exportAs: 'compact'
})
export class DbxCompactDirective {
  readonly compactContextStore = inject(CompactContextStore);
  readonly mode$ = this.compactContextStore.mode$;

  @Input('dbxCompact')
  set mode(mode: CompactMode | boolean) {
    this.compactContextStore.setMode(mode);
  }
}
