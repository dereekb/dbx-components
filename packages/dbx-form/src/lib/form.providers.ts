import { EnvironmentProviders, makeEnvironmentProviders, Provider } from '@angular/core';
import { provideDateFnsAdapter } from '@angular/material-date-fns-adapter';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { enUS } from 'date-fns/locale';
import { DateTimePresetConfiguration, DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN, DEFAULT_DATE_TIME_FIELD_MENU_PRESETS_PRESETS } from './formly';
import { Maybe } from '@dereekb/util';

export interface ProvideDbxFormConfigurationConfig {
  readonly provideDateAdapter?: boolean;
  readonly defaultDateTimePresets?: Maybe<DateTimePresetConfiguration[]>;
}

export function provideDbxFormConfiguration(config?: ProvideDbxFormConfigurationConfig): EnvironmentProviders {
  const { provideDateAdapter, defaultDateTimePresets } = config ?? {};

  const providers: Provider[] = [
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        subscriptSizing: 'dynamic',
        floatLabel: 'always',
        appearance: 'outline'
      }
    },
    {
      provide: DBX_DATE_TIME_FIELD_MENU_PRESETS_TOKEN,
      useValue: defaultDateTimePresets ?? DEFAULT_DATE_TIME_FIELD_MENU_PRESETS_PRESETS
    }
  ];

  if (provideDateAdapter !== false) {
    providers.push(provideDateFnsAdapter());
    providers.push({
      provide: MAT_DATE_LOCALE,
      useValue: enUS
    });
  }

  return makeEnvironmentProviders(providers);
}
