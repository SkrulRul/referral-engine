import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContextStore {
  correlationId: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContextStore>();

export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return requestContextStorage.run({ correlationId }, fn);
}

export function getCorrelationId(): string | undefined {
  return requestContextStorage.getStore()?.correlationId;
}
