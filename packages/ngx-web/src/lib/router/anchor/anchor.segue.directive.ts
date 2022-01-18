import { Directive } from "@angular/core";
import { DbNgxInjectedTemplateConfig } from "@dereekb/ngx-core";
import { Observable } from "rxjs";
import { distinctUntilChanged, shareReplay, map, share } from "rxjs/operators";
import { DbNgxAnchorComponent } from "./anchor.component";

/**
 * Abstract implementation
 */
@Directive()
export abstract class AbstractDbNgxSegueAnchorDirective {

  readonly target$ = this.parent.target$;

  readonly ref$ = this.parent.anchor$.pipe(map(x => x?.ref), distinctUntilChanged(), shareReplay(1));
  readonly refParams$ = this.parent.anchor$.pipe(map(x => x?.refParams), distinctUntilChanged(), shareReplay(1));
  readonly refOptions$ = this.parent.anchor$.pipe(map(x => x?.refOptions), distinctUntilChanged(), shareReplay(1));

  constructor(readonly parent: DbNgxAnchorComponent) { }

  readonly template$: Observable<DbNgxInjectedTemplateConfig> = this.parent.templateRef$.pipe(
    distinctUntilChanged(),
    map(templateRef => ({
      templateRef
    })),
    shareReplay(1)
  );

  get anchorBlockClass(): string {
    return this.parent.anchorBlockClass;
  }

  get anchor() {
    return this.parent.anchor;
  }

}
