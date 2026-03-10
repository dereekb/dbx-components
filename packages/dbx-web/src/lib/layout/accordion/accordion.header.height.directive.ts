import { Directive, computed, inject, input } from '@angular/core';
import { DbxScreenMediaService } from '../../screen/screen.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { type Maybe } from '@dereekb/util';

/**
 * Calculates and applies a dynamic height to a Material expansion panel header based on text content.
 *
 * Sets the `--mat-expansion-header-collapsed-state-height` and `--mat-expansion-header-expanded-state-height`
 * CSS custom properties. On small screens, the estimated line count is scaled up to account for text wrapping.
 * If the calculated height is zero or nullish, no style override is applied.
 *
 * @example
 * ```html
 * <mat-expansion-panel [dbxAccordionHeaderHeight]="64" [heightText]="item.description" [maxHeaderHeight]="120">
 *   <mat-expansion-panel-header>
 *     {{ item.title }}
 *   </mat-expansion-panel-header>
 *   <p>Panel content</p>
 * </mat-expansion-panel>
 * ```
 */
@Directive({
  selector: '[dbxAccordionHeaderHeight]',
  host: {
    '[style]': 'expansionPanelStyleSignal()'
  },
  standalone: true
})
export class DbxAccordionHeaderHeightDirective {
  private readonly _screenMediaService = inject(DbxScreenMediaService);

  /**
   * The base height of the header.
   */
  readonly dbxAccordionHeaderHeight = input<Maybe<number>>(60);

  /**
   * The amount of height to add to the header when expanded.
   */
  readonly expandedHeightIncrease = input<Maybe<number>>(undefined);

  /**
   * The maximum allowed height of the header.
   */
  readonly maxHeaderHeight = input<Maybe<number>>(undefined);

  /**
   * Text used to help determine the height of the header.
   *
   * Height will stay static to the given header height when this is not set.
   *
   * Ignored if heightTextLines is set.
   */
  readonly heightText = input<Maybe<string>>(undefined);

  /**
   * The number of characters used for calculating a line.
   */
  readonly heightTextLineLength = input<number>(30);

  /**
   * Number of lines of text to use for the height calculation.
   */
  readonly heightTextLines = input<Maybe<number>>(undefined);

  /**
   * The amount of height to add for every line of text.
   */
  readonly heightTextLineHeight = input<number>(20);

  /**
   * Multiplier to apply to the height on small screens.
   */
  readonly heightTextSmallScreenMultiplier = input<Maybe<number>>(1.6);

  readonly widthTypeSignal = toSignal(this._screenMediaService.widthType$);

  readonly expansionPanelHeightSignal = computed(() => {
    const baseHeight = this.dbxAccordionHeaderHeight();
    const text = this.heightText();
    const textLines = this.heightTextLines();
    const textLineLength = this.heightTextLineLength();
    const textLineHeight = this.heightTextLineHeight();
    const maxHeaderHeight = this.maxHeaderHeight();
    const widthType = this.widthTypeSignal();
    const isSmallScreen = widthType === 'micro' || widthType === 'small';

    let height: Maybe<number>;

    // calculate lines from text content or use the provided line count
    let lines: Maybe<number> = textLines;

    if (text && textLines == null) {
      const lineLength = textLineLength;
      lines = Math.ceil(text.length / lineLength);
    }

    if (lines != null && lines > 0) {
      const lineHeight = textLineHeight;

      // on small screens text wraps more, so scale up estimated lines
      if (isSmallScreen) {
        const multiplier = this.heightTextSmallScreenMultiplier() ?? 1.6;
        lines = Math.ceil(lines * multiplier);
      }

      height = (baseHeight ?? 60) + lines * lineHeight;
    } else {
      height = baseHeight;
    }

    if (maxHeaderHeight != null && height != null && height > maxHeaderHeight) {
      height = maxHeaderHeight;
    }

    return height;
  });

  readonly expansionPanelStyleSignal = computed(() => {
    const height = this.expansionPanelHeightSignal();
    const expandedHeightIncrease = this.expandedHeightIncrease() ?? 0;

    let result: Maybe<Record<string, string>>;

    if (height != null && height > 0) {
      result = {
        '--mat-expansion-header-collapsed-state-height': `${height}px`,
        '--mat-expansion-header-expanded-state-height': `${height + expandedHeightIncrease}px`
      };
    }

    return result;
  });
}
