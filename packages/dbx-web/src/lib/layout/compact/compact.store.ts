import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { map } from 'rxjs';
import { CompactMode, compactModeFromInput } from './compact';

/**
 * State shape for the compact context store, holding the current compact mode.
 */
export interface CompactContextState {
  mode: CompactMode;
}

/**
 * Injectable component store that manages the current {@link CompactMode} state.
 * Provided at the component level via {@link DbxCompactDirective} and consumed by
 * child components to adapt their layout density.
 */
@Injectable()
export class CompactContextStore extends ComponentStore<CompactContextState> {
  constructor() {
    super({ mode: CompactMode.FULL });
  }

  // MARK: Accessors
  readonly mode$ = this.state$.pipe(map((x) => x.mode));

  // MARK: State Changes
  readonly setMode = this.updater((state, mode: CompactMode | boolean) => ({ mode: compactModeFromInput(mode) }));
}
