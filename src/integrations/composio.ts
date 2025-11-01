import { Composio } from 'composio-core';

export class ComposioClient {
  private client: Composio;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.COMPOSIO_API_KEY;
    if (!key) {
      throw new Error('COMPOSIO_API_KEY not found in environment variables');
    }
    this.client = new Composio({ apiKey: key });
  }

  getClient(): Composio {
    return this.client;
  }
}

export function createComposioClient(apiKey?: string): ComposioClient {
  return new ComposioClient(apiKey);
}
