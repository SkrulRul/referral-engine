import { getCorrelationId, runWithCorrelationId } from './request-context';

describe('request-context', () => {
  it('returns undefined outside a correlation context', () => {
    expect(getCorrelationId()).toBeUndefined();
  });

  it('returns the correct id inside a correlation context', () => {
    runWithCorrelationId('id-1', () => {
      expect(getCorrelationId()).toBe('id-1');
    });
  });

  it('does not leak the id between sequential runs', () => {
    const seenInFirstRun: (string | undefined)[] = [];
    const seenInSecondRun: (string | undefined)[] = [];

    runWithCorrelationId('first', () => {
      seenInFirstRun.push(getCorrelationId());
    });
    runWithCorrelationId('second', () => {
      seenInSecondRun.push(getCorrelationId());
    });

    expect(seenInFirstRun).toEqual(['first']);
    expect(seenInSecondRun).toEqual(['second']);
    expect(getCorrelationId()).toBeUndefined();
  });
});
