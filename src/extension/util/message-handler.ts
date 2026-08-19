import type NodeCG from 'nodecg/types';
import { tokenStore } from './token-store.js';
import { sendAck } from './helpers.js';
import { nodecg } from './nodecg.js';

export type MessageHandlerContext = {
  token: string;
};

export type MessageHandlerConfig<T = unknown> = {
  requiresToken?: 'startgg' | 'challonge';
  handler: (data: T, ack: NodeCG.default.Acknowledgement | undefined, context: MessageHandlerContext) => Promise<void> | void;
};

export function createHandler<T = unknown>(config: MessageHandlerConfig<T>) {
  return async (data: T, ack: NodeCG.default.Acknowledgement | undefined) => {
    try {
      let token = '';
      if (config.requiresToken) {
        const storeToken = tokenStore.getToken(config.requiresToken);
        if (!storeToken) {
          sendAck(ack, `Missing ${config.requiresToken === 'startgg' ? 'start.gg' : 'Challonge'} API token`);
          return;
        }
        token = storeToken;
      }
      await config.handler(data, ack, { token });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      nodecg.log.error(`[message-handler] Error: ${message}`);
      sendAck(ack, message);
    }
  };
}
