import { NgModule } from '@angular/core';
import { DbxAnchorComponent } from './anchor.component';
import { DbxAnchorIconComponent } from './anchor.icon.component';
import { DbxAnchorLinkComponent } from './anchor.link.component';
import { DbxAnchorContentComponent } from './anchor.content.component';

/**
 * All standalone components related to anchors and links.
 */
export const DBX_ROUTER_ANCHOR_COMPONENTS = [DbxAnchorComponent, DbxAnchorIconComponent, DbxAnchorLinkComponent, DbxAnchorContentComponent];

/**
 * Module that provides anchor and link components.
 *
 * All components are now standalone. This module is provided for backward compatibility.
 */
@NgModule({
  imports: DBX_ROUTER_ANCHOR_COMPONENTS,
  exports: DBX_ROUTER_ANCHOR_COMPONENTS
})
export class DbxRouterAnchorModule {}
