import { Directive, computed, effect, inject, input, untracked } from '@angular/core';
import { type LabeledValue, type Maybe } from '@dereekb/util';
import { type DbxColorInput, type DbxColorTone } from '../style/style';
import { DbxColorDirective } from '../style/style.color.directive';

/**
 * Display configuration for a single colored chip.
 *
 * Combines a labeled value with a theme color for rendering a styled chip.
 */
export interface DbxChipDisplay extends LabeledValue<string> {
  /**
   * Optional unique key for tracking in `@for` loops. Falls back to `label` when not provided.
   */
  readonly key?: string;
  /**
   * Theme color or {@link DbxColorConfig} applied to the chip background.
   */
  readonly color?: Maybe<DbxColorInput>;
  /**
   * Whether to render the chip in small mode.
   */
  readonly small?: Maybe<boolean>;
  /**
   * Whether to render the chip in block mode (no border-radius).
   */
  readonly block?: Maybe<boolean>;
  /**
   * Background tone level controlling the opacity of the chip color.
   */
  readonly tone?: Maybe<DbxColorTone>;
}

/**
 * Default background tone percentage for tonal chip coloring.
 */
export const DEFAULT_DBX_CHIP_TONE = 18;

/**
 * Renders a styled chip element with optional small, block, and color modes.
 *
 * Hosts a {@link DbxColorDirective} that provides the color tokens + `.dbx-color` marker the chip's
 * `.dbx-chip.dbx-color` SCSS paints from. The color can be supplied either through the {@link color}/{@link display}
 * inputs (pushed into the host directive) or by binding `[dbxColor]` directly; the chip's tone handling (default
 * {@link DEFAULT_DBX_CHIP_TONE} → tonal text) applies to both.
 *
 * @dbxWebComponent
 * @dbxWebSlug chip
 * @dbxWebCategory text
 * @dbxWebRelated chip-list
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-chip text="Tag"></dbx-chip>
 * ```
 *
 * @example
 * ```html
 * <dbx-chip text="Active" icon="check" color="primary"></dbx-chip>
 * ```
 */
@Directive({
  // eslint-disable-next-line @angular-eslint/directive-selector
  selector: 'dbx-chip',
  host: {
    class: 'dbx-chip',
    '[class]': 'styleSignal()',
    '[class.dbx-color-tonal]': 'isTonalSignal()',
    '[style.--dbx-color-bg-tone]': 'bgToneStyleSignal()'
  },
  hostDirectives: [DbxColorDirective],
  standalone: true
})
export class DbxChipDirective {
  private readonly _dbxColorDirective = inject(DbxColorDirective, { self: true });

  constructor() {
    let originalColor: Maybe<DbxColorInput>;
    let overridden = false;

    // Pushes the chip's resolved color (color input > display config) into the host DbxColorDirective so it stays the
    // single token provider on the element. The directive's own value is restored once the chip stops supplying a color.
    effect(() => {
      const color = this.colorSignal();

      if (color != null) {
        if (!overridden) {
          originalColor = untracked(this._dbxColorDirective.dbxColor);
          overridden = true;
        }

        this._dbxColorDirective.dbxColor.set(color);
      } else if (overridden) {
        this._dbxColorDirective.dbxColor.set(originalColor);
        overridden = false;
      }
    });
  }

  readonly small = input<Maybe<boolean>>();
  readonly block = input<Maybe<boolean>>();

  /**
   * Theme color or {@link DbxColorConfig} applied to the chip, pushed into the host {@link DbxColorDirective}.
   *
   * When {@link display} is also set, its color is used as a fallback.
   */
  readonly color = input<Maybe<DbxColorInput>>();
  /**
   * Display configuration that provides color (and optionally label/value metadata).
   *
   * The color from `display` is used as a fallback when `color` is not explicitly set.
   */
  readonly display = input<Maybe<DbxChipDisplay>>();
  /**
   * Background tone level for tonal appearance. Defaults to {@link DEFAULT_DBX_CHIP_TONE}.
   *
   * Set to `100` for fully opaque background.
   */
  readonly tone = input<Maybe<DbxColorTone>>();

  readonly colorSignal = computed(() => {
    const display = this.display();
    return this.color() ?? display?.color;
  });

  /**
   * The effective color on the host {@link DbxColorDirective} — either pushed from {@link colorSignal} or bound
   * directly via `[dbxColor]`. Drives the chip's tone/tonal handling.
   */
  readonly effectiveColorSignal = computed(() => this._dbxColorDirective.dbxColor());

  readonly toneSignal = computed(() => {
    const display = this.display();
    return this.tone() ?? display?.tone ?? this._dbxColorDirective.effectiveToneSignal() ?? DEFAULT_DBX_CHIP_TONE;
  });

  readonly styleSignal = computed(() => {
    const display = this.display();
    const small = this.small() ?? display?.small;
    const block = this.block() ?? display?.block;

    let style = small ? 'dbx-chip-small' : '';

    if (block) {
      style = style + ' dbx-chip-block';
    }

    return style;
  });

  /**
   * Sets `--dbx-color-bg-tone` on the host to control the background opacity of the painted chip surface.
   * Only applied when a color is set.
   */
  readonly bgToneStyleSignal = computed(() => {
    const tone = this.toneSignal();
    const color = this.effectiveColorSignal();

    if (color) {
      return `${tone}%`;
    }

    return null;
  });

  /**
   * Whether tonal mode is active (color is set and tone < 100). Adds the `dbx-color-tonal`
   * CSS class which overrides text color to the vibrant theme color via CSS rather than
   * an inline style binding (which would conflict with `[ngStyle]`).
   */
  readonly isTonalSignal = computed(() => {
    const tone = this.toneSignal();
    const color = this.effectiveColorSignal();
    return Boolean(color) && tone < 100;
  });
}
