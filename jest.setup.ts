
/**
 * Must be imported here so the Reflect functionality is availble in the Jest instance.
 * 
 * Typically Angular already imports this functionality. NestJS also will import this functionality on its own.
 */
import 'reflect-metadata';
import { RRuleError } from 'rrule';

RRuleError.emitLuxonTzidError = false;
