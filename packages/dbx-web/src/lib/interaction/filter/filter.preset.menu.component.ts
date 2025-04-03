import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { FilterWithPreset } from '@dereekb/rxjs';
import { AbstractDbxPresetFilterMenuDirective } from './filter.preset.directive';
import { dbxPresetFilterMenuButtonIconObservable, dbxPresetFilterMenuButtonTextObservable, DbxPresetFilterMenuConfig } from './filter.menu';
import { MatButton, MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { DbxAnchorComponent } from '../../router/layout/anchor/anchor.component';
import { NgClass } from '@angular/common';

/**
 * Displays a button and menu for filtering presets.
 */
@Component({
  selector: 'dbx-preset-filter-menu',
  templateUrl: './filter.preset.menu.component.html',
  imports: [NgClass, MatButton, MatMenuModule, MatIcon, DbxAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPresetFilterMenuComponent<F extends FilterWithPreset> extends AbstractDbxPresetFilterMenuDirective<F> {
  readonly config = input<DbxPresetFilterMenuConfig>({});
  readonly config$ = toObservable(this.config);

  readonly buttonText$ = dbxPresetFilterMenuButtonTextObservable(this.config$, this.selectedPreset$);
  readonly buttonIcon$ = dbxPresetFilterMenuButtonIconObservable(this.config$, this.selectedPreset$);

  readonly buttonTextSignal = toSignal(this.buttonText$);
  readonly buttonIconSignal = toSignal(this.buttonIcon$);
}
