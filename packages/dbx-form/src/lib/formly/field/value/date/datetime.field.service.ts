import { BehaviorSubject } from 'rxjs';
import { DateTimePresetConfiguration } from './datetime';
import { Inject, Injectable, InjectionToken, Optional } from '@angular/core';
import { Maybe } from '@dereekb/util';

export const DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN = new InjectionToken('DbxDateTimeFieldMenuPresetsServicePresets');

@Injectable({
  providedIn: 'root'
})
export class DbxDateTimeFieldMenuPresetsService {
  private _configurations = new BehaviorSubject<DateTimePresetConfiguration[]>(this.initialConfigs ?? []);

  readonly configurations$ = this._configurations.asObservable();

  get configurations(): DateTimePresetConfiguration[] {
    return this._configurations.value;
  }

  set configurations(configurations: DateTimePresetConfiguration[]) {
    this._configurations.next(configurations);
  }

  constructor(@Inject(DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN) @Optional() private readonly initialConfigs: Maybe<DateTimePresetConfiguration[]>) {}
}
