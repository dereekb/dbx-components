import { type DbxFirebaseDevelopmentWidgetEntry } from '@dereekb/dbx-firebase';
import { DemoSetupDevelopmentWidgetComponent } from './setup.widget.component';

export const DEMO_SETUP_DEVELOPMENT_WIDGET_TYPE = 'demosetupdev';

/**
 * Creates the development widget entry for the demo setup panel.
 *
 * @returns a development widget entry configured with the DemoSetupDevelopmentWidgetComponent
 */
export function demoSetupDevelopmentWidget(): DbxFirebaseDevelopmentWidgetEntry {
  return {
    label: 'Setup',
    widget: {
      type: DEMO_SETUP_DEVELOPMENT_WIDGET_TYPE,
      componentClass: DemoSetupDevelopmentWidgetComponent
    }
  };
}
