import type { Session } from "../../models/poker";
import { cardToPokerStarsStr } from "../cards";

/**
 * Export a full session to a PokerStars-like hand history string.
 * - Uses suits as c/d/h/s.
 * - Includes blinds, hole cards, actions per street, showdown (if complete), and summary.
 */
export function exportSessionToPokerStars(session: Session | null | undefined): string {
  if (!session || session.hands.length === 0) {
    return "No hands to export in current session.";
  }

  let output = "";

  session.hands.forEach((hand) => {
    const date = new Date(hand.timestamp);
    const dateStr = date.toISOString().replace("T", " ").split(".")[0];

    // Header
    output += `PokerStars Hand #${hand.handId}: Hold'em No Limit ($${hand.blinds.smallBlind}/$${hand.blinds.bigBlind}) - ${dateStr} ET\n`;
    output += `Table 'Training Table' 6-max Seat #1 is the button\n`;

    // Seats
    hand.players.forEach((player, seatIndex) => {
      const seat = seatIndex + 1;
      output += `Seat ${seat}: ${player.name} ($1000 in chips)\n`;
    });

    // Blinds
    const sbPlayer = hand.players.find((p) => p.position === "SB");
    const bbPlayer = hand.players.find((p) => p.position === "BB");
    if (sbPlayer) output += `${sbPlayer.name}: posts small blind $${hand.blinds.smallBlind}\n`;
    if (bbPlayer) output += `${bbPlayer.name}: posts big blind $${hand.blinds.bigBlind}\n`;

    // Hole cards
    output += "*** HOLE CARDS ***\n";
    const heroPlayer = hand.players.find((p) => p.isHero);
    if (heroPlayer) {
      output += `Dealt to ${heroPlayer.name} [${cardToPokerStarsStr(heroPlayer.cards[0])} ${cardToPokerStarsStr(heroPlayer.cards[1])}]\n`;
    }

    // Preflop actions
    const preflopActions = hand.actions.filter((a) => a.street === "preflop");
    preflopActions.forEach((action) => {
      const actionStr =
        action.action === "check"
          ? "checks"
          : action.action === "call"
          ? `calls $${action.amount}`
          : action.action === "raise"
          ? `raises $${action.amount}`
          : "folds";
      output += `${action.player}: ${actionStr}\n`;
    });

    // Flop
    if (hand.communityCards.flop) {
      output += `*** FLOP *** [${hand.communityCards.flop.map(cardToPokerStarsStr).join(" ")}]\n`;
      const flopActions = hand.actions.filter((a) => a.street === "flop");
      flopActions.forEach((action) => {
        const actionStr =
          action.action === "check"
            ? "checks"
            : action.action === "call"
            ? `calls $${action.amount}`
            : action.action === "raise"
            ? `bets $${action.amount}`
            : "folds";
        output += `${action.player}: ${actionStr}\n`;
      });
    }

    // Turn
    if (hand.communityCards.turn) {
      const flopStr = hand.communityCards.flop?.map(cardToPokerStarsStr).join(" ") ?? "";
      output += `*** TURN *** [${flopStr} ${cardToPokerStarsStr(hand.communityCards.turn)}]\n`;
      const turnActions = hand.actions.filter((a) => a.street === "turn");
      turnActions.forEach((action) => {
        const actionStr =
          action.action === "check"
            ? "checks"
            : action.action === "call"
            ? `calls $${action.amount}`
            : action.action === "raise"
            ? `bets $${action.amount}`
            : "folds";
        output += `${action.player}: ${actionStr}\n`;
      });
    }

    // River
    if (hand.communityCards.river) {
      const flopStr = hand.communityCards.flop?.map(cardToPokerStarsStr).join(" ") ?? "";
      const turnStr = hand.communityCards.turn ? cardToPokerStarsStr(hand.communityCards.turn) : "";
      output += `*** RIVER *** [${flopStr} ${turnStr} ${cardToPokerStarsStr(hand.communityCards.river)}]\n`;
      const riverActions = hand.actions.filter((a) => a.street === "river");
      riverActions.forEach((action) => {
        const actionStr =
          action.action === "check"
            ? "checks"
            : action.action === "call"
            ? `calls $${action.amount}`
            : action.action === "raise"
            ? `bets $${action.amount}`
            : "folds";
        output += `${action.player}: ${actionStr}\n`;
      });
    }

    // Showdown
    if (
      hand.result === "completed" &&
      hand.communityCards.flop &&
      hand.communityCards.turn &&
      hand.communityCards.river
    ) {
      output += "*** SHOW DOWN ***\n";
      const finalBoard = [
        ...hand.communityCards.flop,
        hand.communityCards.turn,
        hand.communityCards.river,
      ];
      output += `Board [${finalBoard.map(cardToPokerStarsStr).join(" ")}]\n`;
      hand.players.forEach((player) => {
        output += `${player.name}: shows [${cardToPokerStarsStr(player.cards[0])} ${cardToPokerStarsStr(player.cards[1])}]\n`;
      });
    }

    // Summary
    output += "*** SUMMARY ***\n";
    output += `Total pot $${hand.pot}\n`;

    if (
      hand.result === "completed" &&
      hand.communityCards.flop &&
      hand.communityCards.turn &&
      hand.communityCards.river
    ) {
      const finalBoard = [
        ...hand.communityCards.flop,
        hand.communityCards.turn,
        hand.communityCards.river,
      ];
      output += `Board [${finalBoard.map(cardToPokerStarsStr).join(" ")}]\n`;
    }

    const heroPlayerName = heroPlayerNameFromHand(hand);
    if (hand.result === "folded") {
      output += `${heroPlayerName ?? "Hero"} folded\n`;
    } else if (hand.heroWon !== undefined) {
      output += hand.heroWon
        ? `${heroPlayerName ?? "Hero"} wins the pot\n`
        : `${heroPlayerName ?? "Hero"} loses the hand\n`;
    }

    output += "\n\n";
  });

  return output;
}

function heroPlayerNameFromHand(hand: Session["hands"][number]): string | undefined {
  const hero = hand.players.find((p) => p.isHero);
  return hero?.name;
}
