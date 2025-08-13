import type { CardT } from "@/lib/cards";
import { makeDeck, shuffle } from "@/lib/cards";
import {
	dealFlopFromDeck as gpDealFlop,
	dealPlayers as gpDealPlayers,
	dealRiverFromDeck as gpDealRiver,
	dealTurnFromDeck as gpDealTurn,
	nextStreet as gpNextStreet,
	settleBetsIntoPot as gpSettleBets,
} from "@/lib/gameplay";
import type { Player, Settings, Street } from "@/models/poker";
import { useCallback, useMemo, useRef, useState } from "react";

export type GameEngineState = {
  players: Player[];
  deck: CardT[];
  street: Street;
  pot: number;
  flop: [CardT, CardT, CardT] | null;
  turn: CardT | null;
  river: CardT | null;
};

export default function useGameEngine() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [deck, setDeck] = useState<CardT[]>([]);
  const [street, setStreet] = useState<Street>("preflop");
  const [pot, setPot] = useState(0);
  const [flop, setFlop] = useState<[CardT, CardT, CardT] | null>(null);
  const [turn, setTurn] = useState<CardT | null>(null);
  const [river, setRiver] = useState<CardT | null>(null);

  // Keep button index across hands
  const buttonIndexRef = useRef<number | null>(null);

  const resetBoard = useCallback(() => {
    setFlop(null);
    setTurn(null);
    setRiver(null);
  }, []);

  const dealTable = useCallback((n: number, bigBlind: number, opts?: { heroSeat?: number }): { players: Player[]; deck: CardT[] } => {
    const heroSeat = opts?.heroSeat ?? 0;
    // init button index
    if (buttonIndexRef.current == null) buttonIndexRef.current = Math.floor(Math.random() * n);
    else buttonIndexRef.current = (buttonIndexRef.current + 1) % n;

    const fresh = shuffle(makeDeck());
    const { players: dealtPlayers, deck: nextDeck } = gpDealPlayers(n, fresh, bigBlind, heroSeat, buttonIndexRef.current);

    resetBoard();
    setStreet("preflop");
    setDeck(nextDeck);
    setPot(0);
    setPlayers(dealtPlayers);

    return { players: dealtPlayers, deck: nextDeck };
  }, [resetBoard]);

  const settleBets = useCallback(() => {
    const { pot: newPot, players: cleared } = gpSettleBets(pot, players);
    setPot(newPot);
    setPlayers(cleared);
  }, [players, pot]);

  const dealFlop = useCallback(() => {
    if (deck.length < 3 || flop) return false;
    const { flop: f, deck: d } = gpDealFlop(deck);
    setFlop(f);
    setDeck(d);
    setStreet("flop");
    settleBets();
    return true;
  }, [deck, flop, settleBets]);

  const dealTurn = useCallback(() => {
    if (deck.length < 1 || !flop || turn) return false;
    const { turn: t, deck: d } = gpDealTurn(deck);
    setTurn(t);
    setDeck(d);
    setStreet("turn");
    settleBets();
    return true;
  }, [deck, flop, turn, settleBets]);

  const dealRiver = useCallback(() => {
    if (deck.length < 1 || !turn || river) return false;
    const { river: r, deck: d } = gpDealRiver(deck);
    setRiver(r);
    setDeck(d);
    setStreet("river");
    settleBets();
    return true;
  }, [deck, turn, river, settleBets]);

  const advanceStreet = useCallback((settings: Settings): Street => {
    const next = gpNextStreet(street, settings);
    if (street === "preflop" && next === "flop") {
      dealFlop();
    } else if (street === "flop" && next === "turn") {
      dealTurn();
    } else if (street === "turn" && next === "river") {
      dealRiver();
    } else if (next === "complete") {
      // settle any remaining bets on completion
      settleBets();
      setStreet("complete");
    }
    return next;
  }, [street, dealFlop, dealTurn, dealRiver, settleBets]);

  const completeHand = useCallback(() => {
    // Used for folds or forced completion
    settleBets();
    setStreet("complete");
  }, [settleBets]);

  const totalPot = useMemo(() => pot + players.reduce((s, p) => s + (p.bet || 0), 0), [pot, players]);

  return {
    // state
    players, deck, street, pot, flop, turn, river,

    // derived
    totalPot,

    // actions
    dealTable,
    advanceStreet,
    settleBets,
    dealFlop,
    dealTurn,
    dealRiver,
    completeHand,

    // setters for players (for hero action updates)
    setPlayers,
  } as const;
}
