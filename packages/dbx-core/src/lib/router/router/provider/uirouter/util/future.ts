import { mergeArrayIntoArray, objectFlatMergeMatrix } from '@dereekb/util';
import { Ng2StateDeclaration } from '@uirouter/angular';

/**
 * Used for creating a future state that also captures any children urls.
 * 
 * This is important for cases, such as /, where multiple urls should target a specific future so that 
 * it can load that module and continue route resolution for the child url.
 * 
 * For example:
 * - the urls /a and /b are declared in a lazy loaded module that is for /. This presents a problem, since
 * the root module does not know how to handle /a or /b, since they are children of /. We use 
 * futureStateWithChildrenUrls() to build a future state with the child urls so the parent routing knows where
 * to send /a or /b.
 * 
 * @param state 
 * @param urls 
 * @returns 
 * 
 * @deprecated not how this feature works. Consider adding it to ui-router later then re-export this function.
 */
function futureStateWithChildrenUrls(state: Ng2StateDeclaration, urls: string[]): Ng2StateDeclaration[] {
  const states = [state];
  mergeArrayIntoArray(states, expandFutureStateWithUrls(state, urls));
  return states;
}

/**
 * Copies the input state and replaces the url in each of them with the passed urls.
 * 
 * @param state 
 * @param urls 
 * @returns 
 * 
 * @deprecated
 */
function expandFutureStateWithUrls(state: Ng2StateDeclaration, urls: string[]): Ng2StateDeclaration[] {
  const childrenStates = objectFlatMergeMatrix(state, urls.map(url => ({ url })));
  return childrenStates;
}
