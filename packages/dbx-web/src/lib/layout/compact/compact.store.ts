import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { map } from 'rxjs';
import { CompactMode, compactModeFromInput } from './compact';

export interface CompactContextState {
  mode: CompactMode;
}

@Injectable()
export class CompactContextStore extends ComponentStore<CompactContextState> {

  constructor() {
    super({ mode: CompactMode.FULL });
  }

  // MARK: Accessors
  readonly mode$ = this.state$.pipe(map(x => x.mode));

  readonly setMode = this.updater((state, mode: CompactMode | boolean) => ({ mode: compactModeFromInput(mode) }));

}
