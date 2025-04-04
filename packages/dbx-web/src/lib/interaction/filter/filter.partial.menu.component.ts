import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AbstractDbxPartialPresetFilterMenuDirective } from './filter.partial';
import { dbxPresetFilterMenuButtonIconObservable, dbxPresetFilterMenuButtonTextObservable, DbxPresetFilterMenuConfig } from './filter.menu';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButton } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { DbxAnchorComponent } from '../../router';
import { MatMenuModule } from '@angular/material/menu';
import { NgClass } from '@angular/common';

/**
 * Displays a button and menu for filtering partial preset values.
 */
@Component({
  selector: 'dbx-partial-preset-filter-menu',
  templateUrl: './filter.partial.menu.component.html', // share the same template as the preset menu
  imports: [NgClass, MatMenuModule, MatButton, MatIcon, DbxAnchorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxPartialPresetFilterMenuComponent<F> extends AbstractDbxPartialPresetFilterMenuDirective<F> {
  readonly config = input<DbxPresetFilterMenuConfig>({});
  readonly config$ = toObservable(this.config);

  readonly buttonText$ = dbxPresetFilterMenuButtonTextObservable(this.config$, this.firstSelectedPartialPreset$);
  readonly buttonIcon$ = dbxPresetFilterMenuButtonIconObservable(this.config$, this.firstSelectedPartialPreset$);

  readonly buttonTextSignal = toSignal(this.buttonText$);
  readonly buttonIconSignal = toSignal(this.buttonIcon$);
}
