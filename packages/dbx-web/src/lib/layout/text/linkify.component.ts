import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import linkifyStr from 'linkify-string';
import { DomSanitizer } from '@angular/platform-browser';
import { type Maybe } from '@dereekb/util';

/**
 * Used to "linkify" the input text.
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

  readonly text = input<Maybe<string>>();

  readonly linkifiedTextSignal = computed(() => {
    const text = this.text();
    return text ? linkifyStr(text, { defaultProtocol: 'https', target: { url: '_blank' } }) : undefined;
  });

  readonly linkifiedBodySignal = computed(() => {
    const linkifiedText = this.linkifiedTextSignal();
    return linkifiedText ? this.sanitizer.bypassSecurityTrustHtml(linkifiedText) : undefined;
  });
}
