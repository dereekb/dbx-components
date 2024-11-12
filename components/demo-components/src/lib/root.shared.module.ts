import { UIRouterModule } from '@uirouter/angular';
import { NgModule } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { PortalModule } from '@angular/cdk/portal';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CdkStepperModule } from '@angular/cdk/stepper';
import { CdkTableModule } from '@angular/cdk/table';
import { CdkTreeModule } from '@angular/cdk/tree';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatStepperModule } from '@angular/material/stepper';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSortModule } from '@angular/material/sort';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatNativeDateModule, MatRippleModule } from '@angular/material/core';
import { MatTreeModule } from '@angular/material/tree';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { OverlayModule } from '@angular/cdk/overlay';
import { CommonModule } from '@angular/common';
import { FlexLayoutModule } from '@ngbracket/ngx-layout';
import { DbxButtonModule, DbxInteractionModule, DbxRouterLayoutModule, DbxLayoutModule, DbxActionModule, DbxReadableErrorModule, DbxLoadingModule, DbxActionSnackbarModule, DbxStructureModule, DbxTextCompatModule } from '@dereekb/dbx-web';
import { DbxFormExtensionModule } from '@dereekb/dbx-form';
import { DbxAppContextStateModule, DbxCoreAuthModule, DbxPipesModule } from '@dereekb/dbx-core';
import { DbxAnalyticsActionModule } from '@dereekb/dbx-analytics';

const ANGULAR_MODULES = [CommonModule];

const ANGULAR_MATERIAL_MODULES = [
  A11yModule,
  ClipboardModule,
  CdkStepperModule,
  CdkTableModule,
  CdkTreeModule,
  DragDropModule,
  MatBadgeModule,
  MatBottomSheetModule,
  MatButtonToggleModule,
  MatStepperModule,
  MatDatepickerModule,
  MatDividerModule,
  MatExpansionModule,
  MatGridListModule,
  MatIconModule,
  MatNativeDateModule,
  MatRippleModule,
  MatSidenavModule,
  MatSortModule,
  MatToolbarModule,
  MatTreeModule,
  MatDialogModule,
  MatButtonModule,
  MatSnackBarModule,
  MatRadioModule,
  MatSelectModule,
  MatSliderModule,
  MatSlideToggleModule,
  MatTooltipModule,
  MatCheckboxModule,
  MatProgressBarModule,
  MatProgressSpinnerModule,
  MatMenuModule,
  MatInputModule,
  MatAutocompleteModule,
  MatFormFieldModule,
  MatCardModule,
  MatTabsModule,
  MatChipsModule,
  MatListModule,
  OverlayModule,
  PortalModule,
  ScrollingModule,
  // Other Modules
  FlexLayoutModule
];

const DBX_MODULES = [DbxStructureModule, DbxReadableErrorModule, DbxAnalyticsActionModule, DbxCoreAuthModule, DbxActionModule, DbxButtonModule, DbxLoadingModule, DbxInteractionModule, DbxRouterLayoutModule, DbxLayoutModule, DbxFormExtensionModule, DbxActionSnackbarModule, DbxPipesModule, DbxAppContextStateModule];

@NgModule({
  exports: [
    ...ANGULAR_MODULES,
    ...ANGULAR_MATERIAL_MODULES,
    ...DBX_MODULES,
    // UI Router
    UIRouterModule
  ]
})
export class DemoRootSharedModule {}
