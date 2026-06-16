import { LOREM } from './../../shared/lorem';
import { type Type, InjectionToken, inject, Component, ChangeDetectionStrategy } from '@angular/core';
import { DbxContentBoxDirective, DbxSectionComponent, DbxLinkComponent } from '@dereekb/dbx-web';
import { type Maybe } from '@dereekb/util';

export const DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN = new InjectionToken('DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN');

export interface DocFormExampleComponentFormValue {}

export interface DocFormExampleComponentFormConfig {
  readonly componentClass: Type<any>;
  readonly allowDisabledEffects?: Maybe<boolean>;
}

@Component({
  template: `
    <div class="dbx-p3">
      <dbx-content-box class="dbx-primary-bg dbx-color-bg">
        <dbx-section header="A" [hint]="lorem">
          <p>Data injected from configuration: {{ injectedData }}</p>
        </dbx-section>
      </dbx-content-box>
    </div>
  `,
  standalone: true,
  imports: [DbxContentBoxDirective, DbxSectionComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExampleComponentFormTestViewAComponent {
  lorem = LOREM;

  readonly injectedData = inject(DOC_FORM_EXAMPLE_COMPONENT_DATA_TOKEN) as string;
}

@Component({
  template: `
    <div>
      <p>
        <dbx-link>Privacy Policy</dbx-link>
      </p>
      <p>
        <dbx-link>Terms of Service</dbx-link>
      </p>
    </div>
  `,
  standalone: true,
  imports: [DbxLinkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocFormExampleComponentFormTestViewBComponent {}
