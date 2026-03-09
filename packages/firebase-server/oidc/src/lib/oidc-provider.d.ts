declare module 'oidc-provider' {
  export default class Provider {
    constructor(issuer: string, config?: Record<string, any>);
    callback(): any;
    interactionDetails(req: any, res: any): Promise<any>;
    interactionFinished(req: any, res: any, result: any, options?: any): Promise<any>;
    Grant: {
      new (params: { accountId: string; clientId: string }): any;
      find(grantId: string): Promise<any>;
    };
  }
}
