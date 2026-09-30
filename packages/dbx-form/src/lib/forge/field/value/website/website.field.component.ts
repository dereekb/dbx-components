import { Component, input, computed, effect, signal, untracked, type Signal, type InputSignal, DestroyRef, inject, ElementRef } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { type ErrorStateMatcher } from '@angular/material/core';
import { AsyncPipe } from '@angular/common';
import type { DynamicText, FieldMeta, ValidationMessages } from '@ng-forge/dynamic-forms';
import { DynamicTextPipe, DEFAULT_PROPS, DEFAULT_VALIDATION_MESSAGES, resolveValueFieldContext, buildValueFieldInputs, createResolvedErrorsSignal, shouldShowErrors, setupMetaTracking } from '@ng-forge/dynamic-forms/integration';
import { MATERIAL_CONFIG } from '@ng-forge/dynamic-forms-material';
import type { FieldTree } from '@angular/forms/signals';
import { type KnownHttpWebsiteProtocol, type Maybe, type WebsiteUrlRelativePathFunctions, websiteUrlRelativePathFunctions } from '@dereekb/util';
import { type DbxForgeWebsiteUrlFieldProps, type DbxForgeWebsiteUrlFieldValueMode } from './website.field';
import { dbxForgeFieldDisabled } from '../../field.util';
import { toggleDisableFormControl } from '../../../../form/form';

/**
 * Custom ng-forge field component for website url input.
 *
 * Without a base url it behaves like a standard text input.
 *
 * With a base url, the base url is shown as a prefix and the input only contains the relative path that follows it.
 * Pasting a full url, or a url without the protocol, removes the base url from the input. The saved value is either the
 * full website url or only the relative path, depending on the configured value mode.
 *
 * This component bridges a FormControl-based text input with ng-forge Signal Forms.
 *
 * Registered as ng-forge type 'websiteurl'.
 */
@Component({
  selector: 'dbx-forge-websiteurl-field',
  imports: [MatFormFieldModule, MatInputModule, ReactiveFormsModule, DynamicTextPipe, AsyncPipe],
  templateUrl: './website.field.component.html',
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }
      :host mat-form-field {
        width: 100%;
      }
    `
  ]
})
export class DbxForgeWebsiteUrlFieldComponent {
  private readonly materialConfig = inject(MATERIAL_CONFIG, { optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  // Standard ng-forge value field inputs
  readonly field: InputSignal<FieldTree<Maybe<string>>> = input.required<FieldTree<Maybe<string>>>();
  readonly key: InputSignal<string> = input.required<string>();
  readonly label: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly placeholder: InputSignal<DynamicText | undefined> = input<DynamicText | undefined>();
  readonly className: InputSignal<string> = input('');
  readonly tabIndex: InputSignal<number | undefined> = input<number | undefined>();
  readonly props: InputSignal<DbxForgeWebsiteUrlFieldProps | undefined> = input<DbxForgeWebsiteUrlFieldProps | undefined>();
  readonly meta: InputSignal<FieldMeta | undefined> = input<FieldMeta | undefined>();
  readonly validationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();
  readonly defaultValidationMessages: InputSignal<ValidationMessages | undefined> = input<ValidationMessages | undefined>();

  /**
   * Internal FormControl for the text input.
   */
  readonly textCtrl = new FormControl<string>('', { nonNullable: true });

  /**
   * The protocol read from the last url or protocol entered, used for the prefix and the saved url. Is kept when the text is cleared.
   */
  private readonly _protocol = signal<Maybe<KnownHttpWebsiteProtocol>>(undefined);

  /**
   * Whether the current text is a url that does not start with the base url. The prefix is hidden while true.
   */
  private readonly _isUnmatchedUrlText = signal(false);

  /**
   * The last value this component wrote to the field. Used to ignore the field's echo of that value.
   */
  private _lastWrittenValue: Maybe<string>;

  // Computed props
  readonly valueModeSignal: Signal<DbxForgeWebsiteUrlFieldValueMode> = computed(() => this.props()?.valueMode ?? 'url');

  readonly relativePathFunctionsSignal: Signal<Maybe<WebsiteUrlRelativePathFunctions>> = computed(() => {
    const props = this.props();
    const baseUrl = props?.baseUrl;
    return baseUrl ? websiteUrlRelativePathFunctions({ baseUrl, allowHttp: props?.allowHttp }) : undefined;
  });

  readonly prefixSignal: Signal<Maybe<string>> = computed(() => {
    const relativePathFunctions = this.relativePathFunctionsSignal();
    const _protocol = this._protocol();
    const isUnmatchedUrlText = this._isUnmatchedUrlText();
    const protocol = this.valueModeSignal() === 'url' ? _protocol : undefined;
    return isUnmatchedUrlText ? undefined : relativePathFunctions?.toBaseUrl(protocol);
  });

  readonly appearanceSignal = computed(() => this.props()?.appearance ?? this.materialConfig?.appearance ?? 'outline');
  readonly subscriptSizingSignal = computed(() => this.props()?.subscriptSizing ?? this.materialConfig?.subscriptSizing ?? 'dynamic');
  // the label always floats while the prefix is shown, otherwise the prefix is hidden while the input is empty
  readonly floatLabelSignal = computed(() => {
    const prefix = this.prefixSignal();
    return this.props()?.floatLabel ?? (prefix ? 'always' : (this.materialConfig?.floatLabel ?? 'auto'));
  });
  readonly hideRequiredMarkerSignal = computed(() => this.props()?.hideRequiredMarker ?? this.materialConfig?.hideRequiredMarker ?? false);
  readonly inputTypeSignal = computed(() => this.props()?.type ?? 'text');

  // Field state
  private readonly _isFormDisabled = dbxForgeFieldDisabled();
  readonly isDisabledSignal = computed(() => {
    const field = this.field();
    return this._isFormDisabled() || field().disabled();
  });
  readonly isReadonlySignal = computed(() => this.field()().readonly());
  readonly isRequiredSignal = computed(() => this.field()().required());

  // Error handling
  readonly resolvedErrors = createResolvedErrorsSignal(this.field as Signal<FieldTree<unknown>>, this.validationMessages, this.defaultValidationMessages);
  readonly showErrors = shouldShowErrors(this.field as Signal<FieldTree<unknown>>);
  readonly errorsToDisplaySignal = computed(() => (this.showErrors() ? this.resolvedErrors() : []));

  /**
   * Material's error state is driven by the field's errors, since the internal FormControl has no validators.
   */
  readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: () => this.showErrors()
  };

  // ARIA
  protected readonly inputIdSignal = computed(() => `${this.key()}-input`);
  protected readonly hintIdSignal = computed(() => `${this.key()}-hint`);
  protected readonly errorIdSignal = computed(() => `${this.key()}-error`);
  protected readonly ariaInvalidSignal = computed(() => (this.showErrors() ? 'true' : null));
  protected readonly ariaRequiredSignal = computed(() => (this.isRequiredSignal() ? 'true' : null));
  protected readonly ariaDescribedBySignal = computed(() => {
    const errorId = this.errorIdSignal();
    const hintId = this.hintIdSignal();
    if (this.errorsToDisplaySignal().length > 0) return errorId;
    if (this.props()?.hint) return hintId;
    return null;
  });

  constructor() {
    setupMetaTracking(this.elementRef, this.meta, { selector: 'input' });

    // Disabled state propagation. Does not emit, otherwise enabling the control would write the empty text to the field and replace the loaded value.
    effect(() => {
      const disabled = this.isDisabledSignal();
      toggleDisableFormControl(this.textCtrl, disabled, { emitEvent: false });
    });

    // Sync Signal Forms field -> text control (inbound)
    effect(() => {
      const value = this.field()().value();
      const relativePathFunctions = this.relativePathFunctionsSignal();

      untracked(() => {
        // skip the echo of the value this component just wrote, so the text the user is typing is not replaced
        const isEchoOfLastWrittenValue = value === this._lastWrittenValue;
        this._lastWrittenValue = undefined;

        if (!isEchoOfLastWrittenValue) {
          let text: string;
          let protocol: Maybe<KnownHttpWebsiteProtocol>;
          let isUnmatchedUrlText = false;

          if (!value) {
            text = '';
          } else if (relativePathFunctions) {
            const reading = relativePathFunctions.readRelativePath(value);
            text = reading?.relativePath ? reading.relativePath : value;
            protocol = reading?.protocol;
            isUnmatchedUrlText = reading == null;
          } else {
            text = value;
          }

          this._protocol.set(protocol);
          this._isUnmatchedUrlText.set(isUnmatchedUrlText);

          if (text !== this.textCtrl.value) {
            this.textCtrl.setValue(text, { emitEvent: false });
          }
        }
      });
    });

    // Sync text control -> Signal Forms field (outbound)
    const textSub = this.textCtrl.valueChanges.subscribe((text) => this._syncOutbound(text));
    this.destroyRef.onDestroy(() => textSub.unsubscribe());
  }

  /**
   * Called when the text input loses focus. Marks the field as touched and removes any trailing slash or query from the relative path,
   * or the base url when there is no relative path yet.
   */
  onBlur(): void {
    const relativePathFunctions = this.relativePathFunctionsSignal();

    if (relativePathFunctions) {
      const text = this.textCtrl.value;
      const reading = relativePathFunctions.readRelativePath(text);

      if (reading && (reading.relativePath || reading.hadBaseUrl) && reading.relativePath !== text) {
        this.textCtrl.setValue(reading.relativePath);
      }
    }

    this.field()().markAsTouched();
  }

  /**
   * Called when text is pasted into the input. A pasted url replaces the entire input instead of being inserted into the existing relative path.
   *
   * @param event - The paste event.
   */
  onPaste(event: ClipboardEvent): void {
    const relativePathFunctions = this.relativePathFunctionsSignal();
    const pastedText = event.clipboardData?.getData('text')?.trim();

    if (relativePathFunctions && pastedText) {
      const reading = relativePathFunctions.readRelativePath(pastedText);
      const isPastedUrl = reading == null || reading.hadBaseUrl;

      if (isPastedUrl) {
        event.preventDefault();
        this.textCtrl.setValue(pastedText);
      }
    }
  }

  private _syncOutbound(text: string): void {
    const relativePathFunctions = this.relativePathFunctionsSignal();
    let nextValue = text;
    let isUnmatchedUrlText = false;

    // clearing the text keeps the current protocol. The protocol only changes when one is typed or pasted, or when a new value is loaded.
    if (text && relativePathFunctions) {
      const reading = relativePathFunctions.readRelativePath(text);

      if (reading == null) {
        // the prefix stays visible while the start of the base url is still being typed, e.g. "http:" or "linkedin.com/i"
        isUnmatchedUrlText = !relativePathFunctions.isPartialBaseUrl(text);
      } else {
        const { relativePath, hadBaseUrl, protocol } = reading;

        // the base url was typed or pasted, e.g. "http://", "linkedin.com/in/", or "https://linkedin.com/in/dereekb". Only the relative path is kept in the input.
        const isBaseUrlEntered = hadBaseUrl && (relativePath !== '' || protocol != null || text.trimEnd().endsWith('/'));

        if (isBaseUrlEntered) {
          // inputs without a protocol keep the current protocol
          if (protocol != null) {
            this._protocol.set(protocol);
          }

          this.textCtrl.setValue(relativePath, { emitEvent: false });
        }

        // otherwise the text is saved as-is so the validator can flag it
        if (relativePath) {
          nextValue = this.valueModeSignal() === 'url' ? `${relativePathFunctions.toBaseUrl(this._protocol())}${relativePath}` : relativePath;
        } else if (isBaseUrlEntered) {
          nextValue = '';
        }
      }
    }

    this._isUnmatchedUrlText.set(isUnmatchedUrlText);
    this._setFieldValue(nextValue);
  }

  /**
   * Writes a value to the Signal Forms field tree.
   *
   * @param value - The value to set on the field.
   */
  private _setFieldValue(value: string): void {
    const fieldState = this.field()();

    if (value !== fieldState.value()) {
      this._lastWrittenValue = value;
      fieldState.value.set(value);
      fieldState.markAsDirty();
    }
  }
}

// MARK: Mapper
/**
 * Custom mapper for the website url field type.
 *
 * Uses the standard valueFieldMapper pattern from ng-forge/integration to resolve
 * the field tree and build the standard inputs for the component.
 *
 * @param fieldDef - The website url field definition.
 * @param fieldDef.key - Form model key for the field.
 * @returns Signal containing Record of input names to values for ngComponentOutlet.
 */
export function websiteUrlFieldMapper(fieldDef: { key: string }): Signal<Record<string, unknown>> {
  const ctx = resolveValueFieldContext();
  const defaultProps = inject(DEFAULT_PROPS);
  const defaultValidationMessages = inject(DEFAULT_VALIDATION_MESSAGES);

  return computed(() => {
    const inputs = buildValueFieldInputs(fieldDef as any, ctx, defaultProps?.());
    const dvm = defaultValidationMessages?.();
    if (dvm !== undefined) {
      inputs['defaultValidationMessages'] = dvm;
    }
    return inputs;
  });
}
