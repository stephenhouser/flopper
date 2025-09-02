// Export utilities for session data

export function exportSessionToPokerStars(session: any): string {
  if (!session || !session.hands || session.hands.length === 0) {
    return "No session data available for export";
  }

  const lines: string[] = [];
  
  session.hands.forEach((hand: any, index: number) => {
    const handNumber = index + 1;
    const timestamp = new Date(hand.timestamp);
    const formattedDate = timestamp.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    
    // PokerStars Hand Header
    lines.push(`PokerStars Hand #${handNumber}: Hold'em No Limit ($${hand.blinds?.smallBlind || 1}/$${hand.blinds?.bigBlind || 2}) - ${formattedDate} ET`);
    lines.push(`Table 'Flopper Training' 6-max Seat #1 is the button`);
    
    // Seat info
    if (hand.players) {
      hand.players.forEach((player: any, i: number) => {
        lines.push(`Seat ${i + 1}: ${player.name} ($200 in chips)`);
      });
    }
    
    // Blinds
    lines.push(`${hand.players?.[1]?.name || 'Player 2'}: posts small blind $${hand.blinds?.smallBlind || 1}`);
    lines.push(`${hand.players?.[2]?.name || 'Player 3'}: posts big blind $${hand.blinds?.bigBlind || 2}`);
    
    // Hole cards for hero
    const hero = hand.players?.find((p: any) => p.isHero);
    if (hero && hero.cards) {
      const card1 = formatCardForPokerStars(hero.cards[0]);
      const card2 = formatCardForPokerStars(hero.cards[1]);
      lines.push(`*** HOLE CARDS ***`);
      lines.push(`Dealt to ${hero.name} [${card1} ${card2}]`);
    }
    
    // Community cards
    if (hand.communityCards && hand.communityCards.length >= 3) {
      const flop = hand.communityCards.slice(0, 3).map(formatCardForPokerStars).join(' ');
      lines.push(`*** FLOP *** [${flop}]`);
      
      if (hand.communityCards.length >= 4) {
        const turn = formatCardForPokerStars(hand.communityCards[3]);
        lines.push(`*** TURN *** [${flop} ${turn}]`);
        
        if (hand.communityCards.length >= 5) {
          const river = formatCardForPokerStars(hand.communityCards[4]);
          lines.push(`*** RIVER *** [${flop} ${turn} ${river}]`);
        }
      }
    }
    
    // Summary
    lines.push(`*** SUMMARY ***`);
    lines.push(`Total pot $${hand.pot || 0} | Rake $0`);
    if (hand.communityCards && hand.communityCards.length > 0) {
      const boardCards = hand.communityCards.map(formatCardForPokerStars).join(' ');
      lines.push(`Board [${boardCards}]`);
    }
    
    if (hero) {
      if (hand.heroWon) {
        lines.push(`${hero.name}: won ($${hand.pot || 0})`);
      } else {
        lines.push(`${hero.name}: folded`);
      }
    }
    
    lines.push('');
  });

  return lines.join('\n');
}

function formatCardForPokerStars(card: any): string {
  if (!card) return '??';
  
  const rank = card.rank === 14 ? 'A' : 
               card.rank === 13 ? 'K' :
               card.rank === 12 ? 'Q' :
               card.rank === 11 ? 'J' :
               card.rank.toString();
  
  const suit = card.suit === 'spades' ? 's' :
               card.suit === 'hearts' ? 'h' :
               card.suit === 'diamonds' ? 'd' :
               card.suit === 'clubs' ? 'c' : 's';
               
  return rank + suit;
}

export function exportSessionToText(session: any): string {
  return exportSessionToPokerStars(session);
}

export function exportSessionToCSV(session: any): string {
  if (!session || !session.hands) {
    return "session_id,start_time,total_hands\n" + 
           `${session?.id || 'unknown'},${session?.startTime || ''},0`;
  }

  const lines = [];
  lines.push("hand_number,timestamp,pot,result,hero_won");

  session.hands.forEach((hand: any, index: number) => {
    lines.push([
      index + 1,
      new Date(hand.timestamp).toISOString(),
      hand.pot || 0,
      hand.result || '',
      hand.heroWon !== undefined ? hand.heroWon : ''
    ].join(','));
  });

  return lines.join('\n');
}

// Browser-compatible download function
export function downloadTextFile(filename: string, content: string) {
  if (typeof window === 'undefined') {
    // React Native or server-side
    console.log(`Would download file: ${filename}`);
    console.log('Content:', content);
    return;
  }

  // Web browser
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
