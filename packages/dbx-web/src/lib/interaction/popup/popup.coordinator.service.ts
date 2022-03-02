import { DbNgxPopupKey, DbNgxPopupController } from './popup';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Used for coordinating popups and closing/replacing existing ones when a new popup of the same name appears.
 */
@Injectable()
export class DbNgxPopupCoordinatorService {

  private _popups = new BehaviorSubject<Map<DbNgxPopupKey, DbNgxPopupController>>(new Map());

  readonly popups$ = this._popups.asObservable();

  constructor() { }

  get popups(): Map<DbNgxPopupKey, DbNgxPopupController> {
    return this._popups.value;
  }

  public addPopup(popup: DbNgxPopupController): void {
    const key = popup.key;

    if (key) {
      this.removePopup(key);
      this._popups.value.set(key, popup);
      this._popups.next(this.popups);
    }
  }

  public removePopup(key: DbNgxPopupKey, popup?: DbNgxPopupController): void {
    if (key) {
      const existing = this.popups.get(key);

      // Remove if there is one existing, and if popup is provided it is the same popup.
      if (existing && (!popup || popup === existing)) {
        existing.close();
        this._popups.value.delete(key);
        this._popups.next(this.popups);
      }
    }
  }

}
