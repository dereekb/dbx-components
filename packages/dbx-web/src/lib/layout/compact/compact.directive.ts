import { Directive, effect, inject, input } from '@angular/core';
import { type CompactMode } from './compact';
import { CompactContextStore } from './compact.store';

/**
 * Provides a {@link CompactContextStore} to descendant components, allowing them to react
 * to compact vs. full display mode. The mode is set via the directive's input binding.
 *
 * @example
 * ```html
 * <div [dbxCompact]="true">
 *   <!-- Child components can inject CompactContextStore to read the mode -->
 *   <my-component></my-component>
 * </div>
 *
 * <div [dbxCompact]="compactMode">
 *   <my-adaptive-layout></my-adaptive-layout>
 * </div>
 * ```
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
