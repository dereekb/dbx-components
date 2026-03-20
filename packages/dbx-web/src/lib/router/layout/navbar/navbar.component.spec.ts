import { type ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { Component, input } from '@angular/core';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UIRouterModule } from '@uirouter/angular';
import { type ClickableAnchorLink, provideDbxUIRouterService } from '@dereekb/dbx-core';
import { APP_BASE_HREF } from '@angular/common';
import { DbxNavbarComponent } from './navbar.component';
import { provideDbxRouterWebUiRouterProviderConfig } from '../../provider/uirouter/uirouter.router.providers';
import { provideDbxScreenMediaService } from '../../../screen/screen.providers';

describe('NavbarComponent', () => {
  beforeEach(waitForAsync(() => {
    void TestBed.configureTestingModule({
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      imports: [NoopAnimationsModule, UIRouterModule.forRoot()],
      providers: [{ provide: APP_BASE_HREF, useValue: '/' }, provideDbxScreenMediaService(), provideDbxUIRouterService(), provideDbxRouterWebUiRouterProviderConfig()]
    }).compileComponents();
  }));

  let testComponent: TestViewComponent;
  let fixture: ComponentFixture<TestViewComponent>;

  beforeEach(() => {
    fixture = TestBed.createComponent(TestViewComponent);
    testComponent = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('with anchors', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('anchors', [
        {
          title: 'Test',
          ref: 'test'
        }
      ]);

      fixture.detectChanges();
    });

    it('should render', () => {
      // TODO

      expect(true).toBe(true);
    });
  });
});

@Component({
  template: `
    <dbx-navbar [anchors]="anchors()"></dbx-navbar>
  `,
  standalone: true,
  imports: [DbxNavbarComponent]
})
class TestViewComponent {
  readonly anchors = input<ClickableAnchorLink[]>();
}
