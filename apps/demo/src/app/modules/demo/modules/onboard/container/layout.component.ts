import { Component } from '@angular/core';
import { DbxContentPageDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.page.directive';
import { DbxAppContextStateDirective } from '../../../../../../../../../packages/dbx-core/src/lib/context/context.directive';
import { DbxContentContainerDirective } from '../../../../../../../../../packages/dbx-web/src/lib/layout/content/content.container.directive';
import { UIView } from '@uirouter/angular';

@Component({
    templateUrl: './layout.component.html',
    standalone: true,
    imports: [DbxContentPageDirective, DbxAppContextStateDirective, DbxContentContainerDirective, UIView]
})
export class DemoOnboardLayoutComponent {}
