import { BehaviorSubject } from 'rxjs';
import { DateTimePresetConfiguration } from './datetime';
import { Inject, Injectable, InjectionToken, Optional, inject } from '@angular/core';
import { Maybe } from '@dereekb/util';

export const DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN = new InjectionToken('DbxDateTimeFieldMenuPresetsServicePresets');

@Injectable({
  providedIn: 'root'
})
export class DbxDateTimeFieldMenuPresetsService {
  private _configurations = new BehaviorSubject<DateTimePresetConfiguration[]>(inject<Maybe<DateTimePresetConfiguration[]>>(DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN, { optional: true }) ?? []);

  readonly configurations$ = this._configurations.asObservable();

  get configurations(): DateTimePresetConfiguration[] {
    return this._configurations.value;
  }

  set configurations(configurations: DateTimePresetConfiguration[]) {
    this._configurations.next(configurations);
  }
}
