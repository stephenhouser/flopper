import type { CardT } from "@/lib/cards";
import { makeDeck, shuffle } from "@/lib/cards";
import {
  createInitialPlayers as gpCreateInitialPlayers,
  dealFlopFromDeck as gpDealFlop,
  dealPlayers as gpDealPlayers,
  dealRiverFromDeck as gpDealRiver,
  dealTurnFromDeck as gpDealTurn,
  nextStreet as gpNextStreet,
  settleBetsIntoPot as gpSettleBets,
} from "@/lib/gameplay";
import type { Board, Settings, Street } from "@/models/poker";
import { Player } from "@/models/poker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GameEngineState = {
  players: Player[];
  deck: CardT[];
  street: Street;
  pot: number;
  board: Board;
  dealerPosition: number; // Index into players array
};

export function useGameEngine() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [deck, setDeck] = useState<CardT[]>([]);
  const [street, setStreet] = useState<Street>("preflop");
  const [pot, setPot] = useState(0);
  const [board, setBoard] = useState<Board>([]);
  const [dealerPosition, setDealerPosition] = useState(0);

  // Refs to avoid stale closures when actions are called from delayed callbacks
  const playersRef = useRef<Player[]>(players);
  const deckRef = useRef<CardT[]>(deck);
  const streetRef = useRef<Street>(street);
  const potRef = useRef<number>(pot);
  const boardRef = useRef<Board>(board);
  const dealerPositionRef = useRef<number>(dealerPosition);

  useEffect(() => { playersRef.current = players; }, [players]);
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { streetRef.current = street; }, [street]);
  useEffect(() => { potRef.current = pot; }, [pot]);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { dealerPositionRef.current = dealerPosition; }, [dealerPosition]);

  const resetBoard = useCallback(() => {
    setBoard([]);
  }, []);

  const dealTable = useCallback((n: number, bigBlind: number, opts?: { heroSeat?: number }): { players: Player[]; deck: CardT[] } => {
    const heroSeat = opts?.heroSeat ?? 0;
    
    // Preserve existing players and their stacks when possible
    let currentPlayers = players;
    if (players.length !== n) {
      // Create initial players only if the count changed
      currentPlayers = gpCreateInitialPlayers(n, heroSeat, bigBlind);
      
      // If we had existing players, preserve their stacks
      if (players.length > 0) {
        currentPlayers = currentPlayers.map((newPlayer, i) => {
          const existingPlayer = players[i]; // Might be undefined if we added players
          if (existingPlayer) {
            // Preserve stack and hero status from existing player
            return new Player({
              id: newPlayer.id,
              name: newPlayer.name,
              cards: newPlayer.cards,
              position: newPlayer.position,
              nPlayers: newPlayer.nPlayers,
              stack: existingPlayer.stack, // Preserve existing stack
              isHero: newPlayer.isHero,
              bet: 0,
              folded: false,
            });
          }
          return newPlayer; // New player, use default stack
        });
      }
    }
    
    // Advance dealer position (or initialize randomly)
    const newDealerPosition = dealerPosition !== undefined ? (dealerPosition + 1) % n : Math.floor(Math.random() * n);

    const fresh = shuffle(makeDeck());
    const { players: dealtPlayers, deck: nextDeck } = gpDealPlayers(currentPlayers, fresh, bigBlind, newDealerPosition);

    resetBoard();
    setStreet("preflop");
    setDeck(nextDeck);
    setPot(0);
    setPlayers(dealtPlayers);
    setDealerPosition(newDealerPosition);

    return { players: dealtPlayers, deck: nextDeck };
  }, [resetBoard, dealerPosition, players]);

  const settleBets = useCallback(() => {
    // Use refs to guarantee we settle latest bets into latest pot
    const { pot: newPot, players: cleared } = gpSettleBets(potRef.current, playersRef.current);
    setPot(newPot);
    setPlayers(cleared);
  }, []);

  const dealFlop = useCallback(() => {
    const curDeck = deckRef.current;
    const curBoard = boardRef.current;
    if (curDeck.length < 3 || curBoard.length >= 3) return false;
    const { flop: f, deck: d } = gpDealFlop(curDeck);
    setDeck(d);
    setStreet("flop");
    setBoard(() => [...f]);
    settleBets();
    return true;
  }, [settleBets]);

  const dealTurn = useCallback(() => {
    const curDeck = deckRef.current;
    const curBoard = boardRef.current;
    if (curDeck.length < 1 || curBoard.length !== 3) return false;
    const { turn: t, deck: d } = gpDealTurn(curDeck);
    setDeck(d);
    setStreet("turn");
    setBoard((b) => [...b, t]);
    settleBets();
    return true;
  }, [settleBets]);

  const dealRiver = useCallback(() => {
    const curDeck = deckRef.current;
    const curBoard = boardRef.current;
    if (curDeck.length < 1 || curBoard.length !== 4) return false;
    const { river: r, deck: d } = gpDealRiver(curDeck);
    setDeck(d);
    setStreet("river");
    setBoard((b) => [...b, r]);
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

  // Getter using refs for up-to-date value inside delayed callbacks
  const getTotalPot = useCallback(() => {
    const curPot = potRef.current;
    const bets = playersRef.current.reduce((s, p) => s + (p.bet || 0), 0);
    return curPot + bets;
  }, []);

  return {
    // state
    players, deck, street, pot, board, dealerPosition,

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

    // util
    getTotalPot,
  } as const;
}
