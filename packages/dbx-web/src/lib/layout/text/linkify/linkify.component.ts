import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import linkifyStr from 'linkify-string';
import { DomSanitizer } from '@angular/platform-browser';
import { mergeObjects, type Maybe } from '@dereekb/util';
import { type DbxLinkifyStringType, type DbxLinkifyStringOptions } from './linkify';
import { DbxLinkifyService } from './linkify.service';

/**
 * Inline configuration for {@link DbxLinkifyComponent}, allowing a type key and/or custom linkify options.
 */
export interface DbxLinkifyConfig {
  /**
   * The type to use for retrieving pre-configured configuration.
   */
  readonly type?: Maybe<DbxLinkifyStringType>;
  /**
   * Additional options to use for linkification. These options override the default options.
   */
  readonly options?: DbxLinkifyStringOptions;
}

/**
 * Converts URLs and email addresses in plain text into clickable HTML links using the linkify-string library.
 *
 * Options are resolved from {@link DbxLinkifyService} by type, then merged with any inline config overrides.
 *
 * @example
 * ```html
 * <dbx-linkify [text]="'Visit https://example.com for more info.'"></dbx-linkify>
 * <dbx-linkify [text]="description" [type]="'product-description'"></dbx-linkify>
 * ```
 */
@Component({
  selector: 'dbx-linkify',
  template: `
    <span [innerHTML]="linkifiedBodySignal()"></span>
  `,
  host: {
    class: 'dbx-i dbx-linkify'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true
})
export class DbxLinkifyComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly dbxLinkifyService = inject(DbxLinkifyService);

  readonly text = input<Maybe<string>>();
  readonly type = input<Maybe<DbxLinkifyStringType>>();
  readonly config = input<Maybe<DbxLinkifyConfig>>();

  readonly linkifiedTextSignal = computed(() => {
    const text = this.text();
    const type = this.type();
    const config = this.config();

    // Resolve base options from the service
    const entry = this.dbxLinkifyService.getEntry(type ?? config?.type);
    const baseOptions = entry?.options;

    // Merge base options with inline options (inline overrides base)
    const options: DbxLinkifyStringOptions = mergeObjects([baseOptions, config?.options]);

    return text ? linkifyStr(text, options) : undefined;
  });

  readonly linkifiedBodySignal = computed(() => {
    const linkifiedText = this.linkifiedTextSignal();
    return linkifiedText ? this.sanitizer.bypassSecurityTrustHtml(linkifiedText) : undefined;
  });
}
