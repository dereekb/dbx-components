import { HttpsFunction, Runnable } from "firebase-functions";

/**
 * Union of firebase-functions HttpsFunction and Runnable
 */
export type RunnableHttpFunction<I> = HttpsFunction & Runnable<I>;
