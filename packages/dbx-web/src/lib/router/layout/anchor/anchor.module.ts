import { NgModule } from '@angular/core';
import { DbxAnchorComponent } from './anchor.component';
import { DbxAnchorIconComponent } from './anchor.icon.component';
import { DbxLinkComponent } from './anchor.link.component';
import { DbxAnchorContentComponent } from './anchor.content.component';

/**
 * All standalone components related to anchors and links.
 */
export const DBX_ROUTER_ANCHOR_COMPONENTS = [DbxAnchorComponent, DbxAnchorIconComponent, DbxLinkComponent, DbxAnchorContentComponent];

/**
 * NgModule that re-exports all standalone anchor and link components for backward compatibility.
 *
 * Prefer importing individual standalone components directly in new code.
 */
@NgModule({
  imports: DBX_ROUTER_ANCHOR_COMPONENTS,
  exports: DBX_ROUTER_ANCHOR_COMPONENTS
})
export class DbxRouterAnchorModule {}
