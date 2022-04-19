import { DbxPopoverKey, DbxPopoverController } from './popover';
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Used for coordinating popovers and closing/replacing existing ones when a new popover of the same name appears.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxPopoverCoordinatorService implements OnDestroy {

  private _popovers = new BehaviorSubject<Map<DbxPopoverKey, DbxPopoverController>>(new Map());
  readonly popovers$ = this._popovers.asObservable();

  ngOnDestroy(): void {
    this._popovers.complete();
  }

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
