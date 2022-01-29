import { DbNgxWebUIRouterModule } from './../provider/uirouter/uirouter.router.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Component, Input, ViewChild } from '@angular/core';
import { By, BrowserModule } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AnchorType, ClickableAnchor } from '@dereekb/dbx-core';
import { DbNgxAnchorModule } from './anchor.module';
import { UIRouterModule } from '@uirouter/angular';
import { APP_BASE_HREF } from '@angular/common';
import { DbNgxAnchorComponent } from './anchor.component';
import { first } from 'rxjs/operators';

describe('AnchorComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        BrowserModule,
        NoopAnimationsModule,
        DbNgxAnchorModule,
        DbNgxWebUIRouterModule.forRoot(),
        UIRouterModule.forRoot()
      ],
      declarations: [
        TestViewComponent
      ],
      providers: [{ provide: APP_BASE_HREF, useValue: '/' }]
    }).compileComponents();
  });

  let testComponent: TestViewComponent;
  let fixture: ComponentFixture<TestViewComponent>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestViewComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  function testContentWasShown(): void {

    it('should show content', () => {
      const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`#${CUSTOM_CONTENT_ID}`)).nativeElement;
      expect(anchorElement).not.toBeNull();
      expect(anchorElement.textContent).toBe(CUSTOM_CONTENT);
    });

  }

  function testDisabledTests(): void {

    describe('when disabled', () => {

      it('should display the disabled version.', () => {
        testComponent.disabled = true;
        fixture.detectChanges();

        const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-disabled`)).nativeElement;
        expect(anchorElement).not.toBeNull();
      });

    });

  }

  describe('with click config', () => {

    let clicked: boolean;

    beforeEach(async () => {
      clicked = false;
      testComponent.anchor = {
        onClick: () => {
          clicked = true;
        }
      };
      fixture.detectChanges();
    });

    testContentWasShown();
    testDisabledTests();

    it('should have the click type.', (done) => {
      testComponent.anchorComponent?.type$.pipe(first()).subscribe((type) => {
        expect(type).toBe(AnchorType.Clickable);
        done();
      });
    });

    it('should display the click version.', () => {
      const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-click`)).nativeElement;
      expect(anchorElement).not.toBeNull();
    });

    it('should respond to clicks.', (done) => {
      const anchorElement = fixture.debugElement.query(By.css(`.dbx-anchor-click`));
      anchorElement.triggerEventHandler('click', new MouseEvent('click'));
      fixture.whenStable().then(() => {
        expect(clicked).toBe(true);
        done();
      });
    });

  });

  describe('with sref config', () => {

    beforeEach(async () => {
      testComponent.anchor = {
        ref: 'test'
      };
      fixture.detectChanges();
    });

    testContentWasShown();
    testDisabledTests();

    it('should have the sref type.', (done) => {
      testComponent.anchorComponent?.type$.pipe(first()).subscribe((type) => {
        expect(type).toBe(AnchorType.Sref);
        done();
      });
    });

    it('should display the sref version.', () => {
      const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-sref`)).nativeElement;
      expect(anchorElement).not.toBeNull();
    });

  });

  describe('with href config', () => {

    beforeEach(async () => {
      testComponent.anchor = {
        url: 'https://google.com'
      };
      fixture.detectChanges();
    });

    testContentWasShown();
    testDisabledTests();

    it('should have the href type.', (done) => {
      testComponent.anchorComponent?.type$.pipe(first()).subscribe((type) => {
        expect(type).toBe(AnchorType.Href);
        done();
      });
    });

    it('should display the href version.', () => {
      const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-href`)).nativeElement;
      expect(anchorElement).not.toBeNull();
    });

  });

});

const CUSTOM_CONTENT_ID = 'custom-content';
const CUSTOM_CONTENT = 'Custom Content';

@Component({
  template: `
    <dbx-anchor [anchor]="anchor" [disabled]="disabled">
      <span id="${CUSTOM_CONTENT_ID}">${CUSTOM_CONTENT}</span>
    </dbx-anchor>
  `
})
class TestViewComponent {

  @Input()
  public disabled?: boolean;

  @Input()
  public anchor?: ClickableAnchor;

  @ViewChild(DbNgxAnchorComponent, { static: true })
  anchorComponent?: DbNgxAnchorComponent;

}
