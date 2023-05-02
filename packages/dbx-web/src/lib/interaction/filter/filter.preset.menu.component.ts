import { shareReplay, BehaviorSubject, map, combineLatest, distinctUntilChanged, switchMap } from 'rxjs';
import { Component, Input } from '@angular/core';
import { FilterWithPreset } from '@dereekb/rxjs';
import { AbstractDbxPresetFilterMenuComponent } from './filter.preset';
import { dbxPresetFilterMenuButtonIconObservable, dbxPresetFilterMenuButtonTextObservable, DbxPresetFilterMenuConfig } from './filter.menu';

/**
 * Displays a button and menu for filtering presets.
 */
@Component({
  selector: 'dbx-preset-filter-menu',
  templateUrl: './filter.preset.menu.component.html'
})
export class DbxPresetFilterMenuComponent<F extends FilterWithPreset> extends AbstractDbxPresetFilterMenuComponent<F> {
  private _config = new BehaviorSubject<DbxPresetFilterMenuConfig>({});

  readonly buttonText$ = dbxPresetFilterMenuButtonTextObservable(this._config, this.selectedPreset$);
  readonly buttonIcon$ = dbxPresetFilterMenuButtonIconObservable(this._config, this.selectedPreset$);

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
