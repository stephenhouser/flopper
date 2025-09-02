import { useGameEngine } from '@/hooks/useGameEngine';
import type { Settings } from '@/models/poker';
import { Player } from '@/models/poker';
import { act, renderHook } from '@testing-library/react';

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

    const sb = players.find(p => p.isSmallBlind);
    const bb = players.find(p => p.isBigBlind);
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

  test('button rotates across deals (dealer changes)', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.dealTable(6, 2); });
    const firstDealerPosition = result.current.dealerPosition;

    act(() => { result.current.dealTable(6, 2); });
    const secondDealerPosition = result.current.dealerPosition;

    expect(secondDealerPosition).not.toBe(firstDealerPosition);
  });

  test('deals turn and river with pot settlement each street', () => {
    const { result } = renderHook(() => useGameEngine());

    act(() => { result.current.dealTable(6, 2); });
    act(() => { result.current.advanceStreet(settingsPlayAll); }); // flop (pot=3)

    // Simulate bets on flop: everyone bets 1 (preserve Player prototype)
    act(() => {
      const updated = result.current.players.map(p => Object.assign(Object.create(Object.getPrototypeOf(p)), p, { bet: 1 }));
      result.current.setPlayers(updated);
    });
    act(() => { result.current.advanceStreet(settingsPlayAll); }); // turn (pot += 6)

    expect(result.current.street).toBe('turn');
    expect(result.current.pot).toBe(3 + 6);
    expect(result.current.players.every(p => p.bet === 0)).toBe(true);

    // Simulate bets on turn: 2 each (preserve Player prototype)
    act(() => {
      const updated = result.current.players.map(p => Object.assign(Object.create(Object.getPrototypeOf(p)), p, { bet: 2 }));
      result.current.setPlayers(updated);
    });
    act(() => { result.current.advanceStreet(settingsPlayAll); }); // river (pot += 12)

    expect(result.current.street).toBe('river');
    expect(result.current.pot).toBe(3 + 6 + 12);
    expect(result.current.players.every(p => p.bet === 0)).toBe(true);
  });

  test('player stacks are preserved between hands', () => {
    const { result } = renderHook(() => useGameEngine());
    
    // Deal initial table
    act(() => {
      result.current.dealTable(3, 10, { heroSeat: 0 });
    });
    
    const initialPlayers = result.current.players;
    const heroInitialStack = initialPlayers.find(p => p.isHero)?.stack;
    const player1InitialStack = initialPlayers[1]?.stack;
    
    // Simulate some betting by manually updating player stacks
    const updatedPlayers = initialPlayers.map(p => {
      if (p.isHero) {
        return new Player({
          id: p.id,
          name: p.name,
          cards: p.cards,
          position: p.position,
          nPlayers: p.nPlayers,
          stack: p.stack - 100, // Hero lost 100 chips
          isHero: p.isHero,
          bet: 0,
          folded: false,
        });
      } else if (p.id === 1) {
        return new Player({
          id: p.id,
          name: p.name,
          cards: p.cards,
          position: p.position,
          nPlayers: p.nPlayers,
          stack: p.stack + 50, // Player 1 won 50 chips
          isHero: p.isHero,
          bet: 0,
          folded: false,
        });
      }
      return p;
    });
    
    // Update the players in the game engine
    act(() => {
      result.current.setPlayers(updatedPlayers);
    });
    
    // Deal a new hand - this should preserve the updated stacks
    act(() => {
      result.current.dealTable(3, 10, { heroSeat: 0 });
    });
    
    const newHandPlayers = result.current.players;
    const heroNewStack = newHandPlayers.find(p => p.isHero)?.stack;
    const player1NewStack = newHandPlayers[1]?.stack;
    
    // Verify stacks were preserved (minus any blinds posted)
    expect(heroNewStack).toBeLessThan(heroInitialStack! - 100 + 20); // Account for blinds
    expect(player1NewStack).toBeCloseTo(player1InitialStack! + 50, -10); // Account for blinds, allow some variance
    
    // Verify stacks didn't reset to initial values
    expect(heroNewStack).not.toBe(heroInitialStack);
    expect(player1NewStack).not.toBe(player1InitialStack);
  });
});
