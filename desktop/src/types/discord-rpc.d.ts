declare module 'discord-rpc' {
  export class Client {
    constructor(options: { transport: string })
    login(options: { clientId: string }): Promise<void>
    setActivity(activity: Record<string, any>): Promise<void>
    clearActivity(): Promise<void>
    on(event: string, listener: (...args: any[]) => void): void
  }
  export function register(clientId: string): void
  const DiscordRPC: {
    Client: typeof Client
    register: typeof register
    default: { Client: typeof Client; register: typeof register }
  }
  export default DiscordRPC
}
