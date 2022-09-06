import { ChangeDetectorRef, Host, Injectable } from '@angular/core';
import { safeDetectChanges, safeMarkForCheck } from '@dereekb/dbx-core';

/**
 * Provided in the parent component that allows children to import the parent's cdRef for use.
 */
@Injectable({
  providedIn: null
})
export class DbxMapboxChangeDetectorRefService {
  constructor(@Host() readonly cdRef: ChangeDetectorRef) {}

  markForCheck() {
    safeMarkForCheck(this.cdRef);
  }

  detectChanges() {
    safeDetectChanges(this.cdRef);
  }
}
