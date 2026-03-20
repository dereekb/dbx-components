import { Directive, HostListener, inject, computed, input, type Signal, output } from '@angular/core';
import { dbxActionWorkProgress, type DbxActionWorkProgress, type DbxButtonWorking } from '@dereekb/dbx-core';
import { type Configurable, type CssClass, isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { type DbxProgressButtonGlobalConfig, type DbxProgressButtonConfig, type DbxProgressButtonTargetedConfig, DBX_PROGRESS_BUTTON_GLOBAL_CONFIG } from './button.progress.config';
import { toObservable } from '@angular/core/rxjs-interop';
import { type DbxButtonType } from '../button';
import { type ProgressSpinnerMode } from '@angular/material/progress-spinner';

/**
 * Abstract base for progress button components. Manages configuration merging with global defaults,
 * working/disabled state computation, CSS class generation, and click event handling.
 * Subclasses provide the specific template (spinner or bar).
 */
@Directive()
export abstract class AbstractProgressButtonDirective {
  private readonly globalConfig = inject<DbxProgressButtonGlobalConfig>(DBX_PROGRESS_BUTTON_GLOBAL_CONFIG, { optional: true }) ?? [];

  readonly btnClick = output<MouseEvent>();

  readonly config = input.required<Maybe<DbxProgressButtonConfig>>();

  readonly buttonId = input<Maybe<string>>();
  readonly working = input<Maybe<DbxButtonWorking>>();
  readonly disabled = input<Maybe<boolean>>();

  readonly globalOptionsSignal: Signal<Maybe<DbxProgressButtonConfig>> = computed(() => {
    const buttonId = this.buttonId();
    return buttonId ? this.globalConfig.find((config: DbxProgressButtonTargetedConfig) => config.id === buttonId) : undefined;
  });

  readonly configSignal = computed<Maybe<DbxProgressButtonConfig>>(() => {
    const config = this.config();
    const globalConfig = this.globalOptionsSignal();

    let completeConfig: Maybe<Configurable<DbxProgressButtonConfig>>;

    if (config || globalConfig) {
      completeConfig = {
        ...globalConfig,
        ...config
      };

      // set the iconOnly property if the buttonType is icon
      if (completeConfig.buttonType === 'icon') {
        completeConfig.iconOnly = true;
      } else if (completeConfig.iconOnly) {
        completeConfig.buttonType = 'icon';
      }
    }

    return completeConfig;
  });

  readonly baseCssClassSignal = computed(() => {
    const config = this.configSignal();
    const classes: CssClass[] = [config?.customClass ?? ''];

    if (config?.fullWidth) {
      classes.push('fullWidth');
    }

    if (config?.disabled) {
      classes.push('disabled');
    }

    let buttonType: DbxButtonType = 'basic';

    if (config?.iconOnly) {
      buttonType = 'icon';
    } else if (config?.buttonType) {
      buttonType = config.buttonType;
    }

    switch (buttonType) {
      case 'raised':
        classes.push('mat-mdc-raised-button mdc-button--raised');
        break;
      case 'stroked':
        classes.push('mat-mdc-outlined-button mdc-button--outlined');
        break;
      case 'flat':
        classes.push('mat-mdc-unelevated-button mdc-button--unelevated');
        break;
      case 'tonal':
        classes.push('mat-mdc-tonal-button mdc-button--tonal');
        break;
      default:
        classes.push('mat-unthemed');
        break;
    }

    return classes;
  });

  readonly baseCssClasses$ = toObservable(this.baseCssClassSignal);

  readonly workingProgressSignal: Signal<DbxButtonWorking> = computed(() => {
    const working = this.working();
    const config = this.configSignal();
    const configWorking = config?.working;

    return dbxActionWorkProgress([working, configWorking]);
  });

  readonly isWorkingSignal = computed(() => isDefinedAndNotFalse(this.workingProgressSignal()));

  readonly workingValueSignal: Signal<Maybe<DbxActionWorkProgress>> = computed(() => {
    const working = this.workingProgressSignal();
    let result: Maybe<DbxActionWorkProgress>;

    if (typeof working === 'number') {
      result = working;
    }

    return result;
  });

  readonly modeSignal: Signal<ProgressSpinnerMode> = computed(() => {
    const config = this.configSignal();
    const workingValue = this.workingValueSignal();

    const mode = config?.mode;
    let result: ProgressSpinnerMode;

    if (!mode) {
      if (workingValue != null) {
        result = 'determinate';
      } else {
        result = 'indeterminate';
      }
    } else {
      result = mode;
    }

    return result;
  });

  readonly disabledSignal = computed(() => {
    const disabled = this.disabled();
    const configDisabled = this.configSignal()?.disabled;
    return disabled || configDisabled;
  });

  readonly buttonTypeAttributeSignal = computed(() => {
    const options = this.configSignal();
    return options?.buttonTypeAttribute;
  });

  readonly buttonDisabledSignal = computed(() => {
    const working = this.isWorkingSignal();
    const disabled = this.disabledSignal();
    return working || disabled;
  });

  readonly showProgressSignal = computed(() => {
    const working = this.isWorkingSignal();
    const disabled = this.disabledSignal();
    return working && !disabled;
  });

  @HostListener('click', ['$event'])
  public handleClick(event: MouseEvent): void {
    const working = this.isWorkingSignal();
    const disabled = this.disabledSignal();

    if (!working && !disabled) {
      this.btnClick.emit(event);
      event.stopImmediatePropagation();
    }
  }
}
