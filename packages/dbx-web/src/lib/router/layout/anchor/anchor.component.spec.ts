import { DbxWebUIRouterModule } from './../../provider/uirouter/uirouter.router.module';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Component, Input, ViewChild } from '@angular/core';
import { By, BrowserModule } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AnchorType, ClickableAnchor } from '@dereekb/dbx-core';
import { DbxAnchorModule } from './anchor.module';
import { UIRouterModule } from '@uirouter/angular';
import { APP_BASE_HREF } from '@angular/common';
import { DbxAnchorComponent } from './anchor.component';
import { delay, filter, first } from 'rxjs/operators';

describe('AnchorComponent', () => {

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        BrowserModule,
        NoopAnimationsModule,
        DbxAnchorModule,
        DbxWebUIRouterModule.forRoot(),
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

      it('should display the disabled version.', (done) => {
        testComponent.disabled = true;
        fixture.detectChanges();

        testComponent.anchorComponent?.disabled$.pipe(filter(() => true), delay(0)).subscribe((disabled) => {
          expect(disabled).toBe(true);
          fixture.detectChanges();
          const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-disabled`)).nativeElement;
          expect(anchorElement).not.toBeNull();
          done();
        });
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
        expect(type).toBe(AnchorType.CLICKABLE);
        done();
      });
    });

    it('should display the click version.', (done) => {
      testComponent.anchorComponent?.type$.pipe(filter((x) => x === AnchorType.CLICKABLE), delay(0)).subscribe(() => {
        fixture.detectChanges();
        const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-click`)).nativeElement;
        expect(anchorElement).not.toBeNull();
        done();
      });
    });

    it('should respond to clicks.', (done) => {
      testComponent.anchorComponent?.type$.pipe(filter((x) => x === AnchorType.CLICKABLE), delay(0)).subscribe(() => {
        fixture.detectChanges();
        
        const anchorElement = fixture.debugElement.query(By.css(`.dbx-anchor-click`));
        anchorElement.triggerEventHandler('click', new MouseEvent('click'));
        fixture.whenStable().then(() => {
          expect(clicked).toBe(true);
          done();
        });
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
        expect(type).toBe(AnchorType.SREF);
        done();
      });
    });

    it('should display the sref version.', (done) => {
      testComponent.anchorComponent?.type$.pipe(filter((x) => x === AnchorType.SREF), delay(0)).subscribe(() => {
        fixture.detectChanges();
        const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-sref`)).nativeElement;
        expect(anchorElement).not.toBeNull();
        done();
      });
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
        expect(type).toBe(AnchorType.HREF);
        done();
      });
    });

    it('should display the href version.', (done) => {
      testComponent.anchorComponent?.type$.pipe(filter((x) => x === AnchorType.HREF), delay(0)).subscribe(() => {
        fixture.detectChanges();
        const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-href`)).nativeElement;
        expect(anchorElement).not.toBeNull();
        done();
      });
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

  @ViewChild(DbxAnchorComponent, { static: true })
  anchorComponent?: DbxAnchorComponent;

}
