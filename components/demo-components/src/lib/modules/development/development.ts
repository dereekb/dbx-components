import { DbxFirebaseDevelopmentWidgetEntry } from '@dereekb/dbx-firebase';
import { DemoSetupDevelopmentWidgetComponent } from './setup.widget.component';

export const DEMO_SETUP_DEVELOPMENT_WIDGET_TYPE = 'demosetupdev';

export function demoSetupDevelopmentWidget(): DbxFirebaseDevelopmentWidgetEntry {
  return {
    label: 'Setup',
    widget: {
      type: DEMO_SETUP_DEVELOPMENT_WIDGET_TYPE,
      componentClass: DemoSetupDevelopmentWidgetComponent
    }
  };
}
