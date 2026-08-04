import { Module } from '@nestjs/common';
import { DiscordModule, DiscordWebhookModule } from '@dereekb/discord/nestjs';
import { DemoDiscordService } from './discord.service';
import { DemoApiDiscordWebhookService } from './discord.webhook.service';

@Module({
  imports: [DiscordModule, DiscordWebhookModule],
  providers: [DemoDiscordService, DemoApiDiscordWebhookService],
  exports: [DemoDiscordService, DemoApiDiscordWebhookService]
})
export class DemoApiDiscordModule {}
