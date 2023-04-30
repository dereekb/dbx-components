import { shareReplay, BehaviorSubject, map, combineLatest, distinctUntilChanged, switchMap } from 'rxjs';
import { Component, Input } from '@angular/core';
import { FilterWithPreset } from '@dereekb/rxjs';
import { AbstractDbxPartialPresetFilterMenuDirective } from './filter.partial';
import { DbxPresetFilterMenuConfig } from './filter.menu';

/**
 * Displays a button and menu for filtering partial preset values.
 */
@Component({
  selector: 'dbx-partial-preset-filter-menu',
  templateUrl: './filter.partial.menu.component.html'
})
export class DbxPartialPresetFilterMenuComponent<F extends FilterWithPreset> extends AbstractDbxPartialPresetFilterMenuDirective<F> {
  private _config = new BehaviorSubject<DbxPresetFilterMenuConfig>({});

  readonly buttonText$ = combineLatest([this._config, this.firstSelectedPartialPreset$]).pipe(
    map(([config, preset]) => {
      const buttonText = preset?.title ?? config.unknownSelectionText ?? 'Filter';
      return buttonText;
    }),
    distinctUntilChanged(),
    shareReplay(1)
  );

  readonly buttonIcon$ = this._config.pipe(
    switchMap((config) => {
      const filterIcon = config.filterIcon === false ? '' : config.filterIcon || 'arrow_drop_down';

      return this.firstSelectedPartialPreset$.pipe(
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
