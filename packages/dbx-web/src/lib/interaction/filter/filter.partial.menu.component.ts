import { BehaviorSubject } from 'rxjs';
import { Component, Input } from '@angular/core';
import { AbstractDbxPartialPresetFilterMenuDirective } from './filter.partial';
import { dbxPresetFilterMenuButtonIconObservable, dbxPresetFilterMenuButtonTextObservable, DbxPresetFilterMenuConfig } from './filter.menu';

/**
 * Displays a button and menu for filtering partial preset values.
 */
@Component({
  selector: 'dbx-partial-preset-filter-menu',
  templateUrl: './filter.preset.menu.component.html' // share the same template as the preset menu
})
export class DbxPartialPresetFilterMenuComponent<F> extends AbstractDbxPartialPresetFilterMenuDirective<F> {
  private _config = new BehaviorSubject<DbxPresetFilterMenuConfig>({});

  readonly buttonText$ = dbxPresetFilterMenuButtonTextObservable(this._config, this.firstSelectedPartialPreset$);
  readonly buttonIcon$ = dbxPresetFilterMenuButtonIconObservable(this._config, this.firstSelectedPartialPreset$);

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
