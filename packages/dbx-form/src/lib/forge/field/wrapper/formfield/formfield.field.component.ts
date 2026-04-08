import { ChangeDetectionStrategy, Component, computed, viewChild } from '@angular/core';
import { DynamicTextPipe, type FieldWithValidation } from '@ng-forge/dynamic-forms';
import { AsyncPipe } from '@angular/common';
import { AbstractForgeWrapperFieldComponent, provideDbxForgeWrapperFieldDirective } from '../wrapper.field';
import { ForgeWrapperContentComponent } from '../wrapper.content.component';
import type { ForgeFormFieldWrapperProps } from './formfield.field';

/**
 * Forge wrapper field component that renders child fields inside a Material-style
 * outlined container with a notched outline, floating label, and hint/error subscript.
 *
 * This is the forge equivalent of ngx-formly's `FormlyWrapperFormField` which wraps
 * fields in `<mat-form-field>`. Uses `<dbx-forge-wrapper-content />` for the nested
 * DynamicForm rendering and reads its validation state for error display.
 */
@Component({
  selector: 'dbx-forge-form-field-wrapper',
  template: `
    <div class="dbx-forge-form-field-wrapper" [class.dbx-forge-form-field-wrapper-error]="hasError()">
      <div class="dbx-forge-form-field-outline">
        <div class="dbx-forge-form-field-outline-leading"></div>
        <div class="dbx-forge-form-field-outline-notch" [class.dbx-forge-form-field-outline-notch-empty]="!label()">
          @if (label(); as labelText) {
            <span class="dbx-forge-form-field-outline-label">{{ labelText | dynamicText | async }}</span>
          }
        </div>
        <div class="dbx-forge-form-field-outline-trailing"></div>
      </div>
      <div class="dbx-forge-form-field-content">
        <dbx-forge-wrapper-content />
      </div>
    </div>
    <div class="mat-mdc-form-field-subscript-wrapper mat-mdc-form-field-bottom-align">
      @if (showErrors()) {
        <div class="mat-mdc-form-field-error-wrapper">
          <div class="mat-mdc-form-field-error mat-mdc-form-field-bottom-align">{{ firstErrorMessage() }}</div>
        </div>
      } @else if (hintSignal(); as hint) {
        <div class="mat-mdc-form-field-hint-wrapper">
          <div class="mat-mdc-form-field-hint mat-mdc-form-field-bottom-align">{{ hint }}</div>
        </div>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .dbx-forge-form-field-wrapper {
        position: relative;
      }

      /* --- Notched outline --- */
      .dbx-forge-form-field-outline {
        display: flex;
        position: absolute;
        top: 0;
        right: 0;
        left: 0;
        bottom: 0;
        pointer-events: none;
      }

      .dbx-forge-form-field-outline-leading {
        border: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        border-right: none;
        border-radius: var(--mdc-outlined-text-field-container-shape, 8px) 0 0 var(--mdc-outlined-text-field-container-shape, 8px);
        width: 12px;
      }

      .dbx-forge-form-field-outline-notch {
        border-bottom: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        display: flex;
        align-items: flex-start;
        max-width: calc(100% - 24px);
      }

      .dbx-forge-form-field-outline-notch-empty {
        border-top: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        width: 0;
        padding: 0;
      }

      .dbx-forge-form-field-outline-label {
        display: inline-block;
        transform: translateY(-50%);
        padding: 0 4px;
        background: var(--mat-sys-surface, white);
        white-space: nowrap;
        -moz-osx-font-smoothing: grayscale;
        -webkit-font-smoothing: antialiased;
        font-family: var(--mat-form-field-outlined-label-text-populated-font, var(--mat-sys-body-small-font));
        font-size: var(--mat-form-field-outlined-label-text-populated-size, var(--mat-sys-body-small-size));
        line-height: var(--mat-form-field-outlined-label-text-populated-line-height, var(--mat-sys-body-small-line-height));
        letter-spacing: var(--mat-form-field-outlined-label-text-populated-tracking, var(--mat-sys-body-small-tracking));
        font-weight: var(--mat-form-field-outlined-label-text-populated-weight, var(--mat-sys-body-small-weight));
        color: var(--mdc-outlined-text-field-label-text-color, var(--mat-sys-on-surface-variant, rgba(0, 0, 0, 0.6)));
      }

      .dbx-forge-form-field-outline-trailing {
        border: 1px solid var(--mdc-outlined-text-field-outline-color, var(--mat-sys-outline, rgba(0, 0, 0, 0.38)));
        border-left: none;
        border-radius: 0 var(--mdc-outlined-text-field-container-shape, 8px) var(--mdc-outlined-text-field-container-shape, 8px) 0;
        flex-grow: 1;
      }

      /* --- Hover state --- */
      .dbx-forge-form-field-wrapper:hover .dbx-forge-form-field-outline-leading,
      .dbx-forge-form-field-wrapper:hover .dbx-forge-form-field-outline-notch,
      .dbx-forge-form-field-wrapper:hover .dbx-forge-form-field-outline-trailing {
        border-color: var(--mdc-outlined-text-field-hover-outline-color, var(--mat-sys-on-surface, rgba(0, 0, 0, 0.87)));
      }

      /* --- Error state --- */
      .dbx-forge-form-field-wrapper-error .dbx-forge-form-field-outline-leading,
      .dbx-forge-form-field-wrapper-error .dbx-forge-form-field-outline-notch,
      .dbx-forge-form-field-wrapper-error .dbx-forge-form-field-outline-trailing {
        border-color: var(--mdc-outlined-text-field-error-outline-color, var(--mat-sys-error, #f44336));
      }

      .dbx-forge-form-field-wrapper-error .dbx-forge-form-field-outline-label {
        color: var(--mdc-outlined-text-field-error-label-text-color, var(--mat-sys-error, #f44336));
      }

      /* --- Content area --- */
      .dbx-forge-form-field-content {
        position: relative;
        padding: 8px 16px 0;
      }

      /* --- Subscript area --- */
      /* Reuses Material's .mat-mdc-form-field-subscript-wrapper, .mat-mdc-form-field-error-wrapper,
         .mat-mdc-form-field-hint-wrapper, and .mat-mdc-form-field-bottom-align classes for
         consistent typography, spacing, color, and error/hint transition animation. */
    `
  ],
  providers: provideDbxForgeWrapperFieldDirective(ForgeFormFieldWrapperComponent),
  imports: [ForgeWrapperContentComponent, DynamicTextPipe, AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    class: 'mat-mdc-form-field mat-form-field-animations-enabled',
    '[class]': 'className()'
  }
})
export class ForgeFormFieldWrapperComponent extends AbstractForgeWrapperFieldComponent<ForgeFormFieldWrapperProps> {
  readonly contentRef = viewChild(ForgeWrapperContentComponent);

  // Child form validation state via content component
  readonly childErrors = computed(() => this.contentRef()?.errors() ?? []);
  readonly childTouched = computed(() => this.contentRef()?.touched() ?? false);
  readonly childDirty = computed(() => this.contentRef()?.dynamicForm()?.dirty() ?? false);

  // Error display: show errors when the child form has been touched OR is dirty (value changed)
  readonly showErrors = computed(() => (this.childTouched() || this.childDirty()) && this.childErrors().length > 0);
  readonly hasError = computed(() => this.showErrors());
  readonly firstErrorMessage = computed(() => {
    const errors = this.childErrors();

    if (errors.length === 0) {
      return '';
    }

    const error = errors[0];

    // Try raw error message first (set by Angular built-in validators)
    if (error.message) {
      return error.message;
    }

    // Resolve from child field validationMessages by matching error.kind
    const fields = this.props()?.fields;

    if (fields?.length) {
      for (const field of fields) {
        const messages = (field as FieldWithValidation).validationMessages as Record<string, string> | undefined;

        if (messages?.[error.kind]) {
          return messages[error.kind];
        }
      }
    }

    return error.kind;
  });

  // Props
  readonly hintSignal = computed(() => this.props()?.hint);
}
