import { Component } from '@angular/core';
import { DbxContentContainerDirective } from '@dereekb/dbx-web';
import { DocFeatureLayoutComponent } from '../../shared/component/feature.layout.component';
import { DocSupportPageLayoutExampleComponent } from '../examples/support.page.layout.example.component';
import { DocDashboardOverviewLayoutExampleComponent } from '../examples/dashboard.overview.layout.example.component';
import { DocBotStatusLayoutExampleComponent } from '../examples/bot.status.layout.example.component';
import { DocProgramJourneyLayoutExampleComponent } from '../examples/program.journey.layout.example.component';
import { DocCoachingHomeLayoutExampleComponent } from '../examples/coaching.home.layout.example.component';
import { DocCandidateProfileLayoutExampleComponent } from '../examples/candidate.profile.layout.example.component';
import { DocJobPipelineLayoutExampleComponent } from '../examples/job.pipeline.layout.example.component';

@Component({
  templateUrl: './layout-examples.component.html',
  imports: [
    DbxContentContainerDirective,
    DocFeatureLayoutComponent,
    DocDashboardOverviewLayoutExampleComponent,
    DocBotStatusLayoutExampleComponent,
    DocSupportPageLayoutExampleComponent,
    DocProgramJourneyLayoutExampleComponent,
    DocCoachingHomeLayoutExampleComponent,
    DocCandidateProfileLayoutExampleComponent,
    DocJobPipelineLayoutExampleComponent
  ]
})
export class DocExamplesLayoutExamplesComponent {}
