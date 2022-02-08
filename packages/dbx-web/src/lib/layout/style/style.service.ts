import { Destroyable } from '@dereekb/util';
import { switchMapMaybeObs } from '@dereekb/rxjs';
import { BehaviorSubject, Observable, shareReplay } from 'rxjs';
import { Injectable } from '@angular/core';
import { Maybe } from '@dereekb/util';

/**
 * Used for managing styles within an app.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxStyleService implements Destroyable {

  private _style = new BehaviorSubject<Maybe<Observable<string>>>(undefined);
  readonly style$ = this._style.pipe(switchMapMaybeObs(), shareReplay(1));

  constructor() { }

  setStyle(style: Observable<string>) {
    this._style.next(style);
  }

  destroy(): void {
    this._style.complete();
  }

}
