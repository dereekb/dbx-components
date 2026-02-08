import { Component, inject } from '@angular/core';
import { DbxContentContainerDirective, DbxContentPitDirective, DbxHelpContextService, DbxHelpViewPopoverButtonConfig, DbxHelpContextDirective, DbxHelpViewPopoverButtonComponent, DbxHelpViewListComponent } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocFeatureExampleComponent } from '../../shared/component/feature.example.component';
import { toSignal } from '@angular/core/rxjs-interop';
import { HELP_WIDGET_EXAMPLE_CONTEXT_STRING } from '../component/help.widget.example.component';
import { JsonPipe } from '@angular/common';
import { DocExtensionHelpExampleWidgetHeaderComponent } from '../component/help.widget.header.component';
import { HELP_WIDGET_EXAMPLE_CONTEXT_STRING_TWO } from '../component/help.widget.example.two.component';

/**
 * Demo page for the help context system
 */
@Component({
  templateUrl: './help.component.html',
  standalone: true,
  imports: [DbxContentContainerDirective, DocFeatureLayoutComponent, DocFeatureExampleComponent, DbxHelpContextDirective, DbxHelpViewPopoverButtonComponent, DbxHelpViewListComponent, DbxContentPitDirective, JsonPipe]
})
export class DocExtensionHelpComponent {
  private readonly _helpContextService = inject(DbxHelpContextService);

  readonly exampleHelpString = HELP_WIDGET_EXAMPLE_CONTEXT_STRING;

  readonly activeHelpContextStringsSignal = toSignal(this._helpContextService.activeHelpContextStringsArray$, { initialValue: [] });

  readonly testHelpContextStrings = [HELP_WIDGET_EXAMPLE_CONTEXT_STRING];

  readonly helpButtonConfig: DbxHelpViewPopoverButtonConfig = {
    buttonDisplay: { icon: 'live_help', text: 'Help' },
    buttonStyle: { color: 'primary', type: 'raised' },
    popoverHeaderConfig: {
      componentClass: DocExtensionHelpExampleWidgetHeaderComponent
    },
    helpContextStrings: [HELP_WIDGET_EXAMPLE_CONTEXT_STRING, HELP_WIDGET_EXAMPLE_CONTEXT_STRING_TWO]
  };
}
