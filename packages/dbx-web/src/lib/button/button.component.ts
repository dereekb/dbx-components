import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input } from '@angular/core';
import { type ThemePalette } from '@angular/material/core';
import { provideDbxButton, AbstractDbxButtonDirective, hasNonTrivialChildNodes } from '@dereekb/dbx-core';
import { type Configurable, isDefinedAndNotFalse, type Maybe } from '@dereekb/util';
import { type DbxProgressButtonConfig } from './progress/button.progress.config';
import { type DbxColorInput, type DbxThemeColor, isDbxColorConfig } from '../layout/style/style';
import { DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent } from './progress';
import { type ProgressSpinnerMode } from '@angular/material/progress-spinner';
import { NgTemplateOutlet } from '@angular/common';
import { type DbxButtonStyle, type DbxButtonType } from './button';

/**
 * Feature-rich button component that supports loading indicators, multiple Material button styles,
 * custom colors, icons, and floating action button (FAB) mode. Integrates with the dbxAction system
 * for automatic working/disabled state management.
 *
 * @dbxWebComponent
 * @dbxWebSlug button
 * @dbxWebCategory button
 * @dbxWebRelated icon-button, progress-spinner-button, progress-bar-button
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-button text="Save" raised [dbxAction]="saveAction"></dbx-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-button [text]="'Save'" raised [dbxAction]="saveAction">
 * </dbx-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-button icon="delete" flat color="warn" [dbxAction]="deleteAction">
 * </dbx-button>
 * ```
 *
 * @example
 * ```html
 * <dbx-button text="Upload" bar [working]="uploadProgress">
 *   <!-- Uses a progress bar instead of spinner -->
 * </dbx-button>
 * ```
 */
@Component({
  selector: 'dbx-button',
  template: `
    @if (bar()) {
      <dbx-progress-bar-button (btnClick)="clickButton()" [config]="configSignal()" [allowClickPropagation]="allowClickPropagation()">
        <ng-template [ngTemplateOutlet]="content"></ng-template>
      </dbx-progress-bar-button>
    } @else {
      <dbx-progress-spinner-button (btnClick)="clickButton()" [config]="configSignal()" [allowClickPropagation]="allowClickPropagation()">
        <ng-template [ngTemplateOutlet]="content"></ng-template>
      </dbx-progress-spinner-button>
    }
    <!-- Content -->
    <ng-template #content>
      <ng-content></ng-content>
    </ng-template>
  `,
  providers: provideDbxButton(DbxButtonComponent),
  imports: [DbxProgressSpinnerButtonComponent, DbxProgressBarButtonComponent, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxButtonComponent extends AbstractDbxButtonDirective {
  /**
   * Whether the host element has projected content (checked at construction time,
   * before Angular moves the nodes for content projection).
   */
  private readonly _hasProjectedContent: boolean;

  constructor() {
    super();
    const el = inject(ElementRef<HTMLElement>);
    this._hasProjectedContent = hasNonTrivialChildNodes(el.nativeElement);
  }

  readonly bar = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });

  readonly type = input<Maybe<DbxButtonType>>();
  readonly buttonStyle = input<Maybe<DbxButtonStyle>>();

  readonly color = input<Maybe<ThemePalette | DbxColorInput>>();
  readonly spinnerColor = input<Maybe<ThemePalette | DbxThemeColor>>();
  /**
   * @deprecated Use {@link color} with a {@link DbxColorConfig}, e.g. `[color]="{ color: '#ff0066' }"`. The `[dbxColor]` directive applies the background through `.dbx-color-bg`.
   */
  readonly customButtonColor = input<Maybe<string>>();
  readonly customTextColor = input<Maybe<string>>();
  readonly customSpinnerColor = input<Maybe<string>>();

  readonly basic = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly tonal = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly raised = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly stroked = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly flat = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly iconOnly = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly fab = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly customContent = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });
  readonly allowClickPropagation = input<boolean, Maybe<boolean | ''>>(false, { transform: isDefinedAndNotFalse });

  readonly mode = input<Maybe<ProgressSpinnerMode>>();

  readonly styleTypeSignal = computed(() => {
    const iconOnly = this.iconOnly();
    const raised = this.raised();
    const stroked = this.stroked();
    const flat = this.flat();
    const tonal = this.tonal();
    const style = this.buttonStyle();
    let type = this.type() ?? style?.type;

    if (!type) {
      if (iconOnly) {
        type = 'icon';
      } else if (raised) {
        type = 'raised';
      } else if (stroked) {
        type = 'stroked';
      } else if (flat) {
        type = 'flat';
      } else if (tonal) {
        type = 'tonal';
      }
    }

    return type;
  });

  readonly configSignal = computed<DbxProgressButtonConfig>(() => {
    // configure custom style
    const customContent = this.customContent();
    const customStyle = {} as {
      [key: string]: string;
    };

    const buttonStyle = this.buttonStyle();
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- reads the deprecated customButtonColor input/style for backward compatibility until removed
    const customButtonColorValue = this.customButtonColor() ?? buttonStyle?.customButtonColor;

    if (customButtonColorValue) {
      customStyle['background'] = customButtonColorValue;
    }

    const customTextColorValue = this.customTextColor() ?? buttonStyle?.customTextColor;

    if (customTextColorValue) {
      customStyle['color'] = customTextColorValue;
    }

    const customSpinnerColorValue = this.customSpinnerColor() ?? buttonStyle?.customSpinnerColor;
    const customSpinnerColor: Maybe<string> = customSpinnerColorValue ?? customTextColorValue;

    const buttonColor = this.color() ?? buttonStyle?.color;
    // mat-spinner [color] only accepts ThemePalette/named colors, so coerce a DbxColorConfig or empty-string buttonColor away.
    const buttonColorSpinnerFallback: Maybe<ThemePalette | DbxThemeColor> = !buttonColor || isDbxColorConfig(buttonColor) ? undefined : buttonColor;
    const spinnerColor = this.spinnerColor() ?? buttonStyle?.spinnerColor ?? buttonColorSpinnerFallback;

    const disabledSignalValue = this.disabledSignal();
    const disabled = !this.isWorkingSignal() && disabledSignalValue; // Only disabled if we're not working, in order to show the animation.

    const iconValue = this.iconSignal();
    const buttonIcon = iconValue ? { fontIcon: iconValue } : undefined;

    const textValue = this.textSignal();
    const hasTextContent = !!textValue || this._hasProjectedContent || customContent;

    const isIconOnlyButton = buttonIcon && !hasTextContent;
    const fab = this.fab() || buttonStyle?.fab;

    const mode = this.mode() ?? buttonStyle?.mode;
    const working = this.workingSignal();
    const buttonType = this.styleTypeSignal();

    const ariaLabel = this.ariaLabel();

    const config: Configurable<DbxProgressButtonConfig> = {
      fab,
      working,
      buttonIcon,
      customStyle,
      customClass: 'dbx-button ' + (isIconOnlyButton ? 'dbx-button-no-text' : ''),
      text: textValue ?? '',
      hasTextContent,
      buttonType: buttonType ?? (isIconOnlyButton ? 'icon' : 'basic'),
      buttonColor,
      barColor: 'accent',
      mode,
      spinnerColor,
      customSpinnerColor,
      disabled,
      ariaLabel
    };

    // Apply button echo when not working and not disabled
    const echo = this.buttonEchoSignal();

    if (echo && !working && !disabled) {
      if (echo.color) {
        config.buttonColor = echo.color as DbxThemeColor;
      }

      if (echo.iconOnly && isIconOnlyButton) {
        // Icon-only button: directly swap icon and color
        if (echo.icon) {
          config.buttonIcon = { fontIcon: echo.icon };
        }
      } else if (echo.iconOnly) {
        // Text button with iconOnly echo: overlay rendering — text/icon fade out via opacity
        // (staying in DOM to preserve button width), echo icon shows as centered overlay
        config.buttonEcho = echo;
      } else {
        // Direct swap: replace icon and/or text in the config
        if (echo.icon) {
          config.buttonIcon = { fontIcon: echo.icon };
        }

        if (echo.text != null) {
          config.text = echo.text;
        }
      }
    }

    return config;
  });
}
