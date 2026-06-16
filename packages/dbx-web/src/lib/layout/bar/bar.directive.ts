import { Directive } from '@angular/core';

/**
 * Renders a horizontal bar used to visually group or separate content.
 *
 * To give the bar a themed background apply `[dbxColor]` (optionally with `[dbxColorTone]`) directly on the host —
 * the bar paints itself from the supplied color tokens via its `.dbx-bar.dbx-color` SCSS. The directive itself only
 * applies the `.dbx-bar` layout class.
 *
 * @dbxWebComponent
 * @dbxWebSlug bar
 * @dbxWebCategory layout
 * @dbxWebRelated bar-header, pagebar, button-spacer
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <dbx-bar><button>A</button><button>B</button></dbx-bar>
 * ```
 *
 * @example
 * ```html
 * <dbx-bar dbxColor="primary">
 *   <dbx-button text="Save" raised></dbx-button>
 *   <dbx-button-spacer></dbx-button-spacer>
 *   <dbx-button text="Cancel" stroked></dbx-button>
 * </dbx-bar>
 * ```
 */
@Directive({
  selector: 'dbx-bar,[dbxBar]',
  host: {
    class: 'dbx-bar'
  },
  standalone: true
})
export class DbxBarDirective {}
