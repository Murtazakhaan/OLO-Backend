declare module "mailtrap" {
  export class MailtrapClient {
    constructor(config: { token: string; endpoint?: string });
    send(payload: unknown): Promise<unknown>;
  }
}
