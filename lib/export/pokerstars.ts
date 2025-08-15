import type { Session } from "../../models/poker";

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
      output += `Dealt to ${heroPlayer.name} [${heroPlayer.cards[0].cardToPokerStarsStr()} ${heroPlayer.cards[1].cardToPokerStarsStr()}]\n`;
    }

    // Trainer-specific: include ALL players' hole cards (even if not revealed)
    // This deviates from strict PokerStars format but is useful for training exports.
    if (hand.players && hand.players.length > 0) {
      output += "*** ALL HOLE CARDS (TRAINER) ***\n";
      hand.players.forEach((p) => {
        output += `${p.name}: [${p.cards[0].cardToPokerStarsStr()} ${p.cards[1].cardToPokerStarsStr()}]\n`;
      });
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

    // Community cards by street boundaries derived from array length
    const cc = hand.communityCards || [];

    // Flop
    if (cc.length >= 3) {
      const flopStr = cc.slice(0, 3).map((c) => c.cardToPokerStarsStr()).join(" ");
      output += `*** FLOP *** [${flopStr}]\n`;
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
    if (cc.length >= 4) {
      const flopStr = cc.slice(0, 3).map((c) => c.cardToPokerStarsStr()).join(" ");
      const turnStr = cc[3].cardToPokerStarsStr();
      output += `*** TURN *** [${flopStr} ${turnStr}]\n`;
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
    if (cc.length >= 5) {
      const flopStr = cc.slice(0, 3).map((c) => c.cardToPokerStarsStr()).join(" ");
      const turnStr = cc[3].cardToPokerStarsStr();
      const riverStr = cc[4].cardToPokerStarsStr();
      output += `*** RIVER *** [${flopStr} ${turnStr} ${riverStr}]\n`;
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
    if (hand.result === "completed" && cc.length >= 5) {
      output += "*** SHOW DOWN ***\n";
      const finalBoard = cc.slice(0, 5);
      output += `Board [${finalBoard.map((c) => c.cardToPokerStarsStr()).join(" ")}]\n`;
      hand.players.forEach((player) => {
        output += `${player.name}: shows [${player.cards[0].cardToPokerStarsStr()} ${player.cards[1].cardToPokerStarsStr()}]\n`;
      });
    }

    // Summary
    output += "*** SUMMARY ***\n";
    output += `Total pot $${hand.pot}\n`;

    if (hand.result === "completed" && cc.length >= 5) {
      const finalBoard = cc.slice(0, 5);
      output += `Board [${finalBoard.map((c) => c.cardToPokerStarsStr()).join(" ")}]\n`;
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
