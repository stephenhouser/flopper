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
import type { Board, Player, Settings, Street } from "@/models/poker";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";

export type GameEngineState = {
  players: Player[];
  deck: CardT[];
  street: Street;
  pot: number;
  board: Board;
};

export default function useGameEngine() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [deck, setDeck] = useState<CardT[]>([]);
  const [street, setStreet] = useState<Street>("preflop");
  const [pot, setPot] = useState(0);
  const [board, setBoard] = useState<Board>({ flop: null, turn: null, river: null });

  // Refs to avoid stale closures when actions are called from delayed callbacks
  const playersRef = useRef<Player[]>(players);
  const deckRef = useRef<CardT[]>(deck);
  const streetRef = useRef<Street>(street);
  const potRef = useRef<number>(pot);
  const boardRef = useRef<Board>(board);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { streetRef.current = street; }, [street]);
  useEffect(() => { potRef.current = pot; }, [pot]);
  useEffect(() => { boardRef.current = board; }, [board]);

  // Keep button index across hands
  const buttonIndexRef = useRef<number | null>(null);

  const resetBoard = useCallback(() => {
    setBoard({ flop: null, turn: null, river: null });
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
    // Use refs to guarantee we settle latest bets into latest pot
    const { pot: newPot, players: cleared } = gpSettleBets(potRef.current, playersRef.current);
    setPot(newPot);
    setPlayers(cleared);
  }, []);

  const dealFlop = useCallback(() => {
    const curDeck = deckRef.current;
    const curBoard = boardRef.current;
    if (curDeck.length < 3 || curBoard.flop) return false;
    const { flop: f, deck: d } = gpDealFlop(curDeck);
    setDeck(d);
    setStreet("flop");
    setBoard((b) => ({ ...b, flop: f }));
    settleBets();
    return true;
  }, [settleBets]);

  const dealTurn = useCallback(() => {
    const curDeck = deckRef.current;
    const curBoard = boardRef.current;
    if (curDeck.length < 1 || !curBoard.flop || curBoard.turn) return false;
    const { turn: t, deck: d } = gpDealTurn(curDeck);
    setDeck(d);
    setStreet("turn");
    setBoard((b) => ({ ...b, turn: t }));
    settleBets();
    return true;
  }, [settleBets]);

  const dealRiver = useCallback(() => {
    const curDeck = deckRef.current;
    const curBoard = boardRef.current;
    if (curDeck.length < 1 || !curBoard.turn || curBoard.river) return false;
    const { river: r, deck: d } = gpDealRiver(curDeck);
    setDeck(d);
    setStreet("river");
    setBoard((b) => ({ ...b, river: r }));
    settleBets();
    return true;
  }, [settleBets]);

  const advanceStreet = useCallback((settings: Settings): Street => {
    const curStreet = streetRef.current;
    const next = gpNextStreet(curStreet, settings);
    if (curStreet === "preflop" && next === "flop") {
      dealFlop();
    } else if (curStreet === "flop" && next === "turn") {
      dealTurn();
    } else if (curStreet === "turn" && next === "river") {
      dealRiver();
    } else if (next === "complete") {
      // settle any remaining bets on completion
      settleBets();
      setStreet("complete");
    }
    return next;
  }, [dealFlop, dealTurn, dealRiver, settleBets]);

  const completeHand = useCallback(() => {
    // Used for folds or forced completion
    settleBets();
    setStreet("complete");
  }, [settleBets]);

  const totalPot = useMemo(() => pot + players.reduce((s, p) => s + (p.bet || 0), 0), [pot, players]);

  return {
    // state
    players, deck, street, pot, board,

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
