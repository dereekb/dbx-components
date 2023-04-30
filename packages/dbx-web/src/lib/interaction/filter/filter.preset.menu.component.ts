import { shareReplay, BehaviorSubject, map, combineLatest, distinctUntilChanged, switchMap } from 'rxjs';
import { Component, Input } from '@angular/core';
import { FilterWithPreset } from '@dereekb/rxjs';
import { AbstractDbxPresetFilterMenuComponent } from './filter.preset';
import { DbxPresetFilterMenuConfig } from './filter.menu';

/**
 * Displays a button and menu for filtering presets.
 */
@Component({
  selector: 'dbx-preset-filter-menu',
  templateUrl: './filter.preset.menu.component.html'
})
export class DbxPresetFilterMenuComponent<F extends FilterWithPreset> extends AbstractDbxPresetFilterMenuComponent<F> {
  private _config = new BehaviorSubject<DbxPresetFilterMenuConfig>({});

  readonly buttonText$ = combineLatest([this._config, this.selectedPreset$]).pipe(
    map(([config, preset]) => preset?.title ?? config.unknownSelectionText ?? 'Filter'),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly buttonIcon$ = this._config.pipe(
    switchMap((config) => {
      const filterIcon = config.filterIcon === false ? '' : config.filterIcon || 'arrow_drop_down';

      return this.selectedPreset$.pipe(
        map((preset) => {
          let icon: string | undefined;

          if (config.filterIcon === false) {
            if (config.usePresetIcon) {
              icon = preset?.icon;
            }
          } else if (config.usePresetIcon) {
            icon = preset?.icon ?? filterIcon;
          } else {
            icon = filterIcon;
          }

          return icon;
        })
      );
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  @Input()
  get config(): DbxPresetFilterMenuConfig {
    return this._config.value;
  }

  set config(config: DbxPresetFilterMenuConfig) {
    this._config.next(config);
  }

  override ngOnDestroy(): void {
    super.ngOnDestroy();
    this._config.complete();
  }
}
