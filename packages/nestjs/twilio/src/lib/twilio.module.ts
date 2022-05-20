import { Module } from '@nestjs/common';
import { TwilioController } from './twilio.controller';
import { TwilioServiceModule } from './twilio.service.module';

@Module({
  controllers: [TwilioController],
  imports: [
    TwilioServiceModule
  ],
  exports: [],
})
export class TwilioModule { }
