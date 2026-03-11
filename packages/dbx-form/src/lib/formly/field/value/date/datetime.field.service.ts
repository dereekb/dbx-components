import { BehaviorSubject } from 'rxjs';
import { type DateTimePresetConfiguration } from './datetime';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { type Maybe } from '@dereekb/util';

/**
 * Injection token for providing default date-time field menu presets application-wide.
 */
export const DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN = new InjectionToken('DbxDateTimeFieldMenuPresetsServicePresets');

/**
 * Service that manages default date-time preset configurations for all date-time fields.
 *
 * Presets are shown in the date-time field dropdown menu and allow users to quickly
 * select common date/time values (e.g., "Now", "Start of day").
 *
 * Provide default presets via {@link DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN}, or set them
 * dynamically via the `configurations` setter.
 */
@Injectable({
  providedIn: 'root'
})
export class DbxDateTimeFieldMenuPresetsService {
  private readonly _configurations = new BehaviorSubject<DateTimePresetConfiguration[]>(inject<Maybe<DateTimePresetConfiguration[]>>(DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN, { optional: true }) ?? []);

  readonly configurations$ = this._configurations.asObservable();

  get configurations(): DateTimePresetConfiguration[] {
    return this._configurations.value;
  }

  set configurations(configurations: DateTimePresetConfiguration[]) {
    this._configurations.next(configurations);
  }
}
