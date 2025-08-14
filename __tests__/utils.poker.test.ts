import { formatAction } from '@/lib/utils/poker';

describe('formatAction', () => {
  test('capitalizes known actions and returns em dash for empty', () => {
    expect(formatAction('check')).toBe('Check');
    expect(formatAction('call')).toBe('Call');
    expect(formatAction('raise')).toBe('Raise');
    expect(formatAction('fold')).toBe('Fold');
    expect(formatAction('')).toBe('—');
  });
});
