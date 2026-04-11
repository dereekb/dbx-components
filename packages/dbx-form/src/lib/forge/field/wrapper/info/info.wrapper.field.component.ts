import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { MatIconButton } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AbstractForgeWrapperFieldComponent, provideDbxForgeWrapperFieldDirective } from '../wrapper.field';
import { DbxForgeWrapperContentComponent } from '../wrapper.content.component';
import type { DbxForgeInfoWrapperFieldProps } from './info.wrapper.field';

/**
 * Forge wrapper field component that renders child fields inside a flex layout
 * with an info icon button beside them.
 *
 * This is the forge equivalent of formly's `DbxFormInfoWrapperComponent`,
 * providing a content area with a clickable info button on the right side.
 * Supports wrapping groups of fields, not just single fields.
 */
@Component({
  selector: 'dbx-forge-info-wrapper-field',
  templateUrl: './info.wrapper.field.component.html',
  providers: provideDbxForgeWrapperFieldDirective(DbxForgeInfoWrapperFieldComponent),
  imports: [DbxForgeWrapperContentComponent, MatIconButton, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class]': 'className()'
  }
})
export class DbxForgeInfoWrapperFieldComponent extends AbstractForgeWrapperFieldComponent<DbxForgeInfoWrapperFieldProps> {
  readonly ariaLabelSignal = computed(() => {
    return this.props()?.ariaLabel ?? 'More information';
  });

  onClick(): void {
    this.props()?.onInfoClick();
  }
}
