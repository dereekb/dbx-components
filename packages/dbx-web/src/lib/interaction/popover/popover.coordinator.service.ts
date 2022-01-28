import { DbNgxPopoverKey, DbNgxPopoverController } from './popover';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Used for coordinating popovers and closing/replacing existing ones when a new popover of the same name appears.
 */
@Injectable()
export class DbNgxPopoverCoordinatorService {

  private _popovers = new BehaviorSubject<Map<DbNgxPopoverKey, DbNgxPopoverController>>(new Map());
  readonly popovers$ = this._popovers.asObservable();

  get popovers(): Map<DbNgxPopoverKey, DbNgxPopoverController> {
    return this._popovers.value;
  }

  public addPopover(popover: DbNgxPopoverController): void {
    const key = popover.key;

    if (key) {
      this.removePopover(key);
      this._popovers.value.set(key, popover);
      this._popovers.next(this.popovers);
    }
  }

  public removePopover(key: DbNgxPopoverKey, popover?: DbNgxPopoverController): void {
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
