import { Injectable } from "@nestjs/common";
import { ClientWebAppHost, ClientWebAppUrl } from "./client";
import { ClientAppServiceConfig } from "./client.config";

/**
 * Provides information about companion apps and websites for the project.
 */
@Injectable()
export class ClientAppService {

  constructor(readonly config: ClientAppServiceConfig) { }

  get webAppUrl(): ClientWebAppUrl {
    return this.config.client.clientWebAppUrl;
  }

  get webAppHost(): ClientWebAppHost {
    return this.webAppUrl.split('://', 2)[1];
  }

}
