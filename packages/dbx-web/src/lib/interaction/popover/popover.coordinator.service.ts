import { type DbxPopoverKey, type DbxPopoverController } from './popover';
import { Injectable } from '@angular/core';
import { completeOnDestroy } from '@dereekb/dbx-core';
import { BehaviorSubject } from 'rxjs';

/**
 * Root-level service that tracks active popovers by key, ensuring only one popover per key exists at a time.
 *
 * When a new popover is added with a key that already exists, the previous popover is closed automatically.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxPopoverCoordinatorService {
  private readonly _popovers = completeOnDestroy(new BehaviorSubject<Map<DbxPopoverKey, DbxPopoverController>>(new Map()));

  readonly popovers$ = this._popovers.asObservable();

  get popovers(): Map<DbxPopoverKey, DbxPopoverController> {
    return this._popovers.value;
  }

  public addPopover(popover: DbxPopoverController): void {
    const key = popover.key;

    if (key) {
      this.removePopover(key);
      this._popovers.value.set(key, popover);
      this._popovers.next(this.popovers);
    }
  }

  public removePopover(key: DbxPopoverKey, popover?: DbxPopoverController): void {
    if (key) {
      const existing = this.popovers.get(key);

      // Remove if there is one existing, and if popover is provided it is the same popover.
      if (existing && (!popover || popover === existing)) {
        existing.close();
        this._popovers.value.delete(key);
        this._popovers.next(this.popovers);
      }
    }
  }
}
