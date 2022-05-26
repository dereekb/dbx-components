import { Directive, Input } from '@angular/core';
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
  mode$ = this.compactContextStore.mode$;

  constructor(readonly compactContextStore: CompactContextStore) {}

  @Input('dbxCompact')
  set mode(mode: CompactMode | boolean) {
    this.compactContextStore.setMode(mode);
  }
}
