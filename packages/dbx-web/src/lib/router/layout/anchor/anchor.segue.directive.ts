import { Directive } from "@angular/core";
import { DbxInjectedTemplateConfig } from "@dereekb/dbx-core";
import { Observable } from "rxjs";
import { distinctUntilChanged, shareReplay, map, share } from "rxjs/operators";
import { DbxAnchorComponent } from "./anchor.component";

/**
 * Abstract implementation
 */
@Directive()
export abstract class AbstractDbxSegueAnchorDirective {

  readonly target$ = this.parent.target$;

  readonly ref$ = this.parent.anchor$.pipe(map(x => x?.ref), distinctUntilChanged(), shareReplay(1));
  readonly refParams$ = this.parent.anchor$.pipe(map(x => x?.refParams), distinctUntilChanged(), shareReplay(1));
  readonly refOptions$ = this.parent.anchor$.pipe(map(x => x?.refOptions), distinctUntilChanged(), shareReplay(1));

  constructor(readonly parent: DbxAnchorComponent) { }

  readonly template$: Observable<DbxInjectedTemplateConfig> = this.parent.templateRef$.pipe(
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
