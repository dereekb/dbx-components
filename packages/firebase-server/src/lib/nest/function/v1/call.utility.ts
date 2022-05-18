import * as functions from 'firebase-functions';
import { CallableContextWithAuthData, isContextWithAuthData } from "../../../function/context";
import { unauthenticatedContextHasNoUidError } from '../../../function/error';
import { OnCallWithNestContext } from "./call";

export type OnCallWithAuthorizedNestContext<C, I = any, O = any> = (nestContext: C, data: I, context: CallableContextWithAuthData) => O;

/**
 * Creates an OnCallWithNestContext wrapper that validates the input CallableContext to assert the context has auth data before entering the function.
 * 
 * @param fn 
 * @returns 
 */
export function inAuthContext<C, I, O>(fn: OnCallWithAuthorizedNestContext<C, I, O>): OnCallWithNestContext<C, I, O> {
  return (nestContext: C, data: I, context: functions.https.CallableContext) => {
    if (isContextWithAuthData(context)) {
      return fn(nestContext, data, context);
    } else {
      throw unauthenticatedContextHasNoUidError();
    }
  }
}
