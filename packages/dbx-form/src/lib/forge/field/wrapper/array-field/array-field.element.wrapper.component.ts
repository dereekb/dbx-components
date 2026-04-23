import { ChangeDetectionStrategy, Component, computed, inject, input, viewChild, ViewContainerRef } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { type DynamicText, type FieldWrapperContract, type WrapperFieldInputs, ARRAY_CONTEXT } from '@ng-forge/dynamic-forms';
import { type IndexNumber } from '@dereekb/util';
import { type DbxButtonDisplayStylePair, type DbxButtonStyle, type DbxChipDisplay, DbxButtonComponent, DbxButtonSpacerDirective, DbxChipDirective } from '@dereekb/dbx-web';
import { dbxForgeFieldDisabled } from '../../field.util';
import { type DbxForgeArrayFieldElementWrapperProps, type DbxForgeArrayItemEvaluationFn } from './array-field.element.wrapper';
import { DbxForgeArrayFieldWrapperComponent } from './array-field.wrapper.component';
import { DbxForgeFormContextService } from '../../../form/forge.context.service';

/**
 * Default display for the per-item index chip — small, grey background.
 */
const DEFAULT_INDEX_CHIP_DISPLAY: DbxChipDisplay = {
  label: '',
  value: '',
  small: true,
  color: 'grey'
};

/**
 * Default display + style for the per-item duplicate button.
 */
const DEFAULT_DUPLICATE_BUTTON: DbxButtonDisplayStylePair = {
  style: { type: 'stroked', color: 'primary' },
  display: { text: 'Duplicate' }
};

/**
 * Forge wrapper component that wraps a single array item with
 * a drag handle, item label, and remove button.
 */
@Component({
  selector: 'dbx-forge-array-field-element-wrapper',
  templateUrl: './array-field.element.wrapper.component.html',
  imports: [CdkDrag, CdkDragHandle, CdkDragPlaceholder, DbxChipDirective, MatIconModule, MatButtonModule, DbxButtonComponent, DbxButtonSpacerDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxForgeArrayFieldElementWrapperComponent implements FieldWrapperContract {
  readonly fieldComponent = viewChild.required('fieldComponent', { read: ViewContainerRef });

  private readonly parent = inject(DbxForgeArrayFieldWrapperComponent);
  private readonly formContextService = inject(DbxForgeFormContextService);

  readonly arrayContext = inject(ARRAY_CONTEXT);

  // Disabled state
  readonly isDisabled = dbxForgeFieldDisabled();

  // Props from wrapper config (ng-forge passes wrapper config properties as individual inputs)
  readonly fieldInputs = input<WrapperFieldInputs>();
  readonly props = input<DbxForgeArrayFieldElementWrapperProps>();

  readonly disableRearrangeSignal = computed(() => this.props()?.disableRearrange ?? false);

  readonly showIndexChipSignal = computed(() => this.props()?.showIndexChip ?? true);

  readonly indexChipDisplaySignal = computed<DbxChipDisplay>(() => {
    const displayFn = this.props()?.indexChipDisplay;
    let result: DbxChipDisplay = DEFAULT_INDEX_CHIP_DISPLAY;

    if (typeof displayFn === 'function') {
      const ctx = this.formContextService.createArrayItemEvaluationContext({ arrayContext: this.arrayContext, reactive: true });
      result = (displayFn as DbxForgeArrayItemEvaluationFn<DbxChipDisplay>)(ctx);
    }

    return result;
  });

  readonly allowRemoveSignal = computed(() => {
    const allowRemove = this.props()?.allowRemove;
    let result: boolean;

    if (typeof allowRemove === 'function') {
      const ctx = this.formContextService.createArrayItemEvaluationContext({ arrayContext: this.arrayContext, reactive: true });
      result = (allowRemove as DbxForgeArrayItemEvaluationFn<boolean>)(ctx);
    } else {
      result = allowRemove ?? true;
    }

    return result;
  });

  readonly removeTextSignal = computed<string>(() => {
    const text = this.props()?.removeText;
    return typeof text === 'string' ? text : 'Remove';
  });

  readonly removeButtonStyleSignal = computed<DbxButtonStyle>(() => this.props()?.removeButtonStyle ?? { type: 'stroked', color: 'warn' });

  /**
   * Resolves {@link DbxForgeArrayFieldElementWrapperProps.allowDuplicate} to either
   * `false` (hide the button) or a target {@link IndexNumber}. `true` maps to the
   * default insert position — immediately after the source item.
   */
  readonly duplicateTargetIndexSignal = computed<false | IndexNumber>(() => {
    const allowDuplicate = this.props()?.allowDuplicate;
    const currentIndex = this.arrayContext.index();
    let result: false | IndexNumber = false;

    if (allowDuplicate != null && allowDuplicate !== false) {
      let resolved: boolean | IndexNumber;

      if (typeof allowDuplicate === 'function') {
        const ctx = this.formContextService.createArrayItemEvaluationContext({ arrayContext: this.arrayContext, reactive: true });
        resolved = (allowDuplicate as DbxForgeArrayItemEvaluationFn<boolean | IndexNumber>)(ctx);
      } else {
        resolved = allowDuplicate;
      }

      if (resolved === true) {
        result = currentIndex + 1;
      } else if (resolved !== false) {
        result = resolved;
      }
    }

    return result;
  });

  readonly allowDuplicateSignal = computed(() => this.duplicateTargetIndexSignal() !== false);

  readonly duplicateButtonSignal = computed<DbxButtonDisplayStylePair>(() => {
    const duplicateButton = this.props()?.duplicateButton;
    let result: DbxButtonDisplayStylePair;

    if (typeof duplicateButton === 'function') {
      const ctx = this.formContextService.createArrayItemEvaluationContext({ arrayContext: this.arrayContext, reactive: true });
      result = (duplicateButton as DbxForgeArrayItemEvaluationFn<DbxButtonDisplayStylePair>)(ctx);
    } else {
      result = duplicateButton ?? DEFAULT_DUPLICATE_BUTTON;
    }

    return result;
  });

  readonly labelSignal = computed(() => {
    const props = this.props();
    const index = this.arrayContext.index();
    const labelForEntry = props?.labelForEntry;
    // When the index chip is visible, it already shows the position —
    // skip the "1." prefix on the label to avoid duplication.
    const showChip = this.showIndexChipSignal();
    const prefix = showChip ? '' : `${index + 1}.`;
    let result = prefix;

    if (labelForEntry != null) {
      let label: DynamicText;

      if (typeof labelForEntry === 'function') {
        const ctx = this.formContextService.createArrayItemEvaluationContext({ arrayContext: this.arrayContext, reactive: true });
        label = (labelForEntry as DbxForgeArrayItemEvaluationFn<DynamicText>)(ctx);
      } else {
        label = labelForEntry;
      }

      if (label != null && label !== '') {
        result = prefix ? `${prefix} ${label}` : `${label}`;
      }
    }

    return result;
  });

  removeItem(): void {
    this.parent.removeItem(this.arrayContext.index());
  }

  duplicateItem(): void {
    const targetIndex = this.duplicateTargetIndexSignal();

    if (targetIndex !== false) {
      this.parent.duplicateItem(this.arrayContext.index(), targetIndex);
    }
  }
}
