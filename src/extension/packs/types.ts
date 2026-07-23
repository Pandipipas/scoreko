export type { PackCharacter, PackManifest } from '../../types/index.js';

export type HandledAcknowledgement = { handled: true };
export type UnhandledAcknowledgement = ((error?: Error | null, ...args: unknown[]) => void) & { handled: false };
export type Acknowledgement = HandledAcknowledgement | UnhandledAcknowledgement;

export const reply = (ack: Acknowledgement | undefined, err: Error | null, result?: unknown): void => {
  if (ack && !ack.handled) ack(err ?? undefined, result);
};
