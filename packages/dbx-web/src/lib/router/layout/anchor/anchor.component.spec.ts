import { provideDbxRouterWebUiRouterProviderConfig } from './../../provider/uirouter/uirouter.router.providers';
import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component, input, viewChild } from '@angular/core';
import { By } from '@angular/platform-browser';
import { type ClickableAnchor } from '@dereekb/dbx-core';
import { APP_BASE_HREF } from '@angular/common';
import { DbxAnchorComponent } from './anchor.component';
import { delay, filter, first } from 'rxjs';
import { callbackTest } from '@dereekb/util/test';
import { vi } from 'vitest';
import { provideUIRouter } from '@uirouter/angular';

vi.setConfig({ testTimeout: 1000 });

describe('AnchorComponent', () => {
  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      providers: [provideUIRouter(), provideDbxRouterWebUiRouterProviderConfig(), { provide: APP_BASE_HREF, useValue: '/' }]
    });
  }));

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
      it(
        'should display the disabled version.',
        callbackTest((done) => {
          fixture.componentRef.setInput('disabled', true);
          fixture.detectChanges();

          testComponent
            .anchorComponent()
            ?.disabled$.pipe(
              filter(() => true),
              delay(0)
            )
            .subscribe((disabled) => {
              expect(disabled).toBe(true);
              fixture.detectChanges();
              const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-disabled`)).nativeElement;
              expect(anchorElement).not.toBeNull();
              done();
            });
        })
      );
    });
  }

  describe('with click config', () => {
    let clicked: boolean;

    beforeEach(async () => {
      clicked = false;

      fixture.componentRef.setInput('anchor', {
        onClick: () => {
          clicked = true;
        }
      });

      fixture.detectChanges();
    });

    testContentWasShown();
    testDisabledTests();

    it(
      'should have the click type.',
      callbackTest((done) => {
        testComponent
          .anchorComponent()
          ?.type$.pipe(first())
          .subscribe((type) => {
            expect(type).toBe('clickable');
            done();
          });
      })
    );

    it(
      'should display the click version.',
      callbackTest((done) => {
        testComponent
          .anchorComponent()
          ?.type$.pipe(
            filter((x) => x === 'clickable'),
            delay(0)
          )
          .subscribe(() => {
            fixture.detectChanges();
            const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-click`)).nativeElement;
            expect(anchorElement).not.toBeNull();
            done();
          });
      })
    );

    it(
      'should respond to clicks.',
      callbackTest((done) => {
        testComponent
          .anchorComponent()
          ?.type$.pipe(
            filter((x) => x === 'clickable'),
            delay(0)
          )
          .subscribe(() => {
            fixture.detectChanges();

            const anchorElement = fixture.debugElement.query(By.css(`.dbx-anchor-click`));
            anchorElement.triggerEventHandler('click', new MouseEvent('click'));
            void fixture.whenStable().then(() => {
              expect(clicked).toBe(true);
              done();
            });
          });
      })
    );
  });

  describe('with sref config', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('anchor', {
        ref: 'test'
      });

      fixture.detectChanges();
      fixture.detectChanges();
    });

    testContentWasShown();
    testDisabledTests();

    it(
      'should have the sref type.',
      callbackTest((done) => {
        testComponent
          .anchorComponent()
          ?.type$.pipe(first())
          .subscribe((type) => {
            expect(type).toBe('sref');
            done();
          });
      })
    );

    it(
      'should display the sref version.',
      callbackTest((done) => {
        testComponent
          .anchorComponent()
          ?.type$.pipe(
            filter((x) => x === 'sref'),
            delay(0)
          )
          .subscribe(() => {
            fixture.detectChanges();
            const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-sref`)).nativeElement;
            expect(anchorElement).not.toBeNull();
            done();
          });
      })
    );
  });

  describe('with href config', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('anchor', {
        url: 'https://google.com'
      });
      fixture.detectChanges();
    });

    testContentWasShown();
    testDisabledTests();

    it(
      'should have the href type.',
      callbackTest((done) => {
        testComponent
          .anchorComponent()
          ?.type$.pipe(first())
          .subscribe((type) => {
            expect(type).toBe('href');
            done();
          });
      })
    );

    it(
      'should display the href version.',
      callbackTest((done) => {
        testComponent
          .anchorComponent()
          ?.type$.pipe(
            filter((x) => x === 'href'),
            delay(0)
          )
          .subscribe(() => {
            fixture.detectChanges();
            const anchorElement: HTMLElement = fixture.debugElement.query(By.css(`.dbx-anchor-href`)).nativeElement;
            expect(anchorElement).not.toBeNull();
            done();
          });
      })
    );
  });
});

const CUSTOM_CONTENT_ID = 'custom-content';
const CUSTOM_CONTENT = 'Custom Content';

@Component({
  template: `
    <dbx-anchor [anchor]="anchor()" [disabled]="disabled()">
      <span id="custom-content">Custom Content</span>
    </dbx-anchor>
  `,
  standalone: true,
  imports: [DbxAnchorComponent]
})
class TestViewComponent {
  readonly anchorComponent = viewChild.required(DbxAnchorComponent);

  readonly disabled = input<boolean>();
  readonly anchor = input<ClickableAnchor>();
}
