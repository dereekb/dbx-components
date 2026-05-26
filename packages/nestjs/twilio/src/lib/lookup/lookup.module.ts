import { Module } from '@nestjs/common';
import { TwilioModule } from '../twilio.module';
import { TwilioLookupApi } from './lookup.api';
import { TwilioLookupService } from './lookup.service';

/**
 * NestJS module that exposes Twilio Lookup v2 (phone validation, carrier info).
 *
 * Imports {@link TwilioModule} for the underlying Twilio client.
 */
@Module({
  imports: [TwilioModule],
  providers: [TwilioLookupApi, TwilioLookupService],
  exports: [TwilioLookupApi, TwilioLookupService]
})
export class TwilioLookupModule {}
