import { DiscordApi } from '@dereekb/nestjs/discord';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class DemoDiscordService {
  private readonly _discordApi: DiscordApi;

  constructor(@Inject(DiscordApi) discordApi: DiscordApi) {
    this._discordApi = discordApi;
  }

  get discordApi(): DiscordApi {
    return this._discordApi;
  }
}

export interface DemoDiscordServiceRef {
  readonly discordService: DemoDiscordService;
}
