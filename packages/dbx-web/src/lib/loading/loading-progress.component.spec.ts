import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { DbxLoadingModule } from './loading.module';

describe('DbxLoadingProgress', () => {
  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DbxLoadingModule],
      declarations: [LoadingProgressSpinnerComponent, LoadingProgressLinearComponent]
    }).compileComponents();
  });

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
  `
})
class LoadingProgressSpinnerComponent {
  text?: string;
}

@Component({
  template: `
    <dbx-loading-progress [linear]="true" [text]="text"></dbx-loading-progress>
  `
})
class LoadingProgressLinearComponent {
  text?: string;
}
