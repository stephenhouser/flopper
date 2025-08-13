import React from 'react';
import { renderHook, act } from '@testing-library/react';
import useGameEngine from '@/hooks/useGameEngine';
import type { Settings } from '@/models/poker';

// Make shuffling deterministic for tests
jest.mock('@/lib/cards', () => {
  const actual = jest.requireActual('@/lib/cards');
  return {
    ...actual,
    shuffle: <T,>(arr: T[]) => arr, // identity
  };
});

describe('useGameEngine hook', () => {
  const settingsPlayAll: Settings = { showFlop: true, showTurn: true, showRiver: true };
  const settingsPreOnly: Settings = { showFlop: false, showTurn: true, showRiver: true };

  test('dealTable initializes players, blinds, and deck', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => {
      result.current.dealTable(6, 2, { heroSeat: 0 });
    });

    const { players, deck, street, pot } = result.current;
    expect(players).toHaveLength(6);
    expect(deck.length).toBeGreaterThan(0);
    expect(street).toBe('preflop');
    expect(pot).toBe(0);

    const sb = players.find(p => p.role === 'SB');
    const bb = players.find(p => p.role === 'BB');
    expect(sb?.bet).toBe(1);
    expect(bb?.bet).toBe(2);
  });

  test('advanceStreet to flop turns blinds into pot and resets bets', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.dealTable(6, 2); });
    act(() => { result.current.advanceStreet(settingsPlayAll); });

    const { street, pot, players } = result.current;
    expect(street).toBe('flop');
    expect(pot).toBe(3); // SB+BB
    expect(players.every(p => p.bet === 0)).toBe(true);
  });

  test('advanceStreet completes immediately when showFlop=false', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.dealTable(6, 2); });
    act(() => { result.current.advanceStreet(settingsPreOnly); });

    expect(result.current.street).toBe('complete');
    expect(result.current.pot).toBe(3);
    expect(result.current.players.every(p => p.bet === 0)).toBe(true);
  });

  test('button rotates across deals (Dealer index changes)', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.dealTable(6, 2); });
    const firstDealerIndex = result.current.players.findIndex(p => p.role === 'Dealer');

    act(() => { result.current.dealTable(6, 2); });
    const secondDealerIndex = result.current.players.findIndex(p => p.role === 'Dealer');

    expect(secondDealerIndex).not.toBe(firstDealerIndex);
  });

  test('deals turn and river with pot settlement each street', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.dealTable(6, 2); });
    act(() => { result.current.advanceStreet(settingsPlayAll); }); // flop (pot=3)

    // Simulate bets on flop: everyone bets 1
    act(() => {
      const updated = result.current.players.map(p => ({ ...p, bet: 1 }));
      result.current.setPlayers(updated);
    });
    act(() => { result.current.advanceStreet(settingsPlayAll); }); // turn (pot += 6)

    expect(result.current.street).toBe('turn');
    expect(result.current.pot).toBe(3 + 6);
    expect(result.current.players.every(p => p.bet === 0)).toBe(true);

    // Simulate bets on turn: 2 each
    act(() => {
      const updated = result.current.players.map(p => ({ ...p, bet: 2 }));
      result.current.setPlayers(updated);
    });
    act(() => { result.current.advanceStreet(settingsPlayAll); }); // river (pot += 12)

    expect(result.current.street).toBe('river');
    expect(result.current.pot).toBe(3 + 6 + 12);
    expect(result.current.players.every(p => p.bet === 0)).toBe(true);
  });
});
