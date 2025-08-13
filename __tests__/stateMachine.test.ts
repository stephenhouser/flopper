import { nextStreet } from '@/lib/gameplay';
import { HAND_STATE_MACHINE, STREET_ORDER, type Settings } from '@/models/poker';

describe('hand progression state machine and settings', () => {
  test('STREET_ORDER is ordered correctly', () => {
    expect(STREET_ORDER).toEqual(["preflop","flop","turn","river","complete"]);
  });

  test('HAND_STATE_MACHINE maps each street to the next', () => {
    expect(HAND_STATE_MACHINE.preflop).toBe('flop');
    expect(HAND_STATE_MACHINE.flop).toBe('turn');
    expect(HAND_STATE_MACHINE.turn).toBe('river');
    expect(HAND_STATE_MACHINE.river).toBe('complete');
    expect(HAND_STATE_MACHINE.complete).toBe('complete');
  });

  test('nextStreet with all streets enabled walks through the full order', () => {
    const sAll: Settings = { showFlop: true, showTurn: true, showRiver: true };
    let cur: any = 'preflop';
    cur = nextStreet(cur, sAll); expect(cur).toBe('flop');
    cur = nextStreet(cur, sAll); expect(cur).toBe('turn');
    cur = nextStreet(cur, sAll); expect(cur).toBe('river');
    cur = nextStreet(cur, sAll); expect(cur).toBe('complete');
  });

  test('nextStreet with flop disabled completes immediately after preflop', () => {
    const sPreOnly: Settings = { showFlop: false, showTurn: true, showRiver: true };
    const cur = nextStreet('preflop', sPreOnly);
    expect(cur).toBe('complete');
  });
});
