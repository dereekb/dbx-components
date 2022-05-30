import { Module } from '@nestjs/common';
import { GuestbookModule } from './guestbook/guestbook.module';
import { ProfileModule } from './profile/profile.module';

@Module({
  imports: [ProfileModule, GuestbookModule],
  exports: [ProfileModule, GuestbookModule]
})
export class DemoApiModelModule {}
