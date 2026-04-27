import { Directive, input, computed } from '@angular/core';

/**
 * Padding options for a content container. Controls the horizontal padding around the content.
 */
export type DbxContentContainerPadding = 'none' | 'min' | 'small' | 'normal';

/**
 * Width constraint options for a content container. Controls the maximum width of the content area.
 */
export type DbxContentContainerWidth = 'small' | 'medium' | 'large' | 'wide' | 'full';

/**
 * Constrains content to a maximum width with configurable padding. Useful for centering
 * page content and maintaining readable line lengths.
 *
 * @dbxWebComponent
 * @dbxWebSlug content-container
 * @dbxWebCategory layout
 * @dbxWebRelated content, content-page, content-box
 * @dbxWebSkillRefs dbx__ref__dbx-ui-building-blocks
 * @dbxWebMinimalExample ```html
 * <div dbxContentContainer>Body</div>
 * ```
 *
 * @example
 * ```html
 * <dbx-content-container grow="full" padding="normal">
 *   <p>Page body</p>
 * </dbx-content-container>
 * ```
 */
@Directive({
  selector: 'dbx-content-container,[dbxContentContainer],.dbx-content-container',
  host: {
    class: 'd-block dbx-content-container',
    '[class]': `classConfig()`
  },
  standalone: true
})
export class DbxContentContainerDirective {
  readonly grow = input<DbxContentContainerWidth>('wide');
  readonly padding = input<DbxContentContainerPadding>('normal');
  readonly topPadding = input<DbxContentContainerPadding>('none');

  readonly classConfig = computed(() => {
    return 'container-' + this.grow() + ' container-padding-' + this.padding() + ' container-top-padding-' + this.topPadding();
  });
}
