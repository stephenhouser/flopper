// Simple test to verify stack persistence between hands
const { useGameEngine } = require('./hooks/useGameEngine');

// This won't work directly since it's a React hook, but let's verify the logic manually
console.log("Testing stack persistence../..");

// Let's manually test the dealTable logic
const { createInitialPlayers, dealPlayers } = require('./lib/gameplay');
const { makeDeck, shuffle } = require('./lib/cards');

// Create initial players
const players1 = createInitialPlayers(3, 0, 10);
console.log('Initial players:', players1.map(p => ({ name: p.name, stack: p.stack })));

// Modify stacks to simulate betting
players1[0].stack = 950; // Hero lost 50
players1[1].stack = 1050; // Player 1 won 50

console.log('After betting:', players1.map(p => ({ name: p.name, stack: p.stack })));

// Now simulate dealing a new hand
const deck = shuffle(makeDeck());
const { players: newPlayers } = dealPlayers(players1, deck, 10, 1);

console.log('After new deal:', newPlayers.map(p => ({ name: p.name, stack: p.stack, position: p.position })));
