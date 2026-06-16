import { type AsyncFirebaseFunctionUpdateAction, type FirebaseFunctionUpdateAction } from "@dereekb/firebase";
import { type ExampleDocument } from "./example";

export type ExampleUpdateAction<P extends object> = FirebaseFunctionUpdateAction<P, ExampleDocument>;
export type AsyncExampleUpdateAction<P extends object> = AsyncFirebaseFunctionUpdateAction<P, ExampleDocument>;
