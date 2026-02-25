import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbxLoadingProgressComponent } from './loading-progress.component';

describe('DbxLoadingProgress', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({});
  }));

  describe('with spinner', () => {
    let fixture: ComponentFixture<LoadingProgressSpinnerComponent>;
    let component: LoadingProgressSpinnerComponent;

    beforeEach(() => {
      fixture = TestBed.createComponent(LoadingProgressSpinnerComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });
  });

  describe('with linear', () => {
    let fixture: ComponentFixture<LoadingProgressLinearComponent>;
    let component: LoadingProgressLinearComponent;

    beforeEach(() => {
      fixture = TestBed.createComponent(LoadingProgressLinearComponent);
      component = fixture.componentInstance;
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });
  });
});

@Component({
  template: `
    <dbx-loading-progress [text]="text"></dbx-loading-progress>
  `,
  standalone: true,
  imports: [DbxLoadingProgressComponent]
})
class LoadingProgressSpinnerComponent {
  text?: string;
}

@Component({
  template: `
    <dbx-loading-progress [linear]="true" [text]="text"></dbx-loading-progress>
  `,
  standalone: true,
  imports: [DbxLoadingProgressComponent]
})
class LoadingProgressLinearComponent {
  text?: string;
}
