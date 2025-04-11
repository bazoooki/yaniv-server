import { GameEngine, Player } from "../game/gameEngine";

// Initialize players
const players: Player[] = [
  { id: "p1", name: "Alice", hand: [], score: 0 },
  { id: "p2", name: "Bob", hand: [], score: 0 },
];

// Create new game
const game = new GameEngine(players);

console.log("=== Initial Hands ===");
game.players.forEach((p) =>
  console.log(`${p.name}: ${p.hand.map((c) => `${c.value}${c.suit}`).join(" ")}`)
);

// Simulate one turn
const current = game.getCurrentPlayer();
console.log(`\n➡️ ${current.name}'s turn`);

const drawnCard = game.drawCard();
current.hand.push(drawnCard);
console.log(`${current.name} draws ${drawnCard.value}${drawnCard.suit}`);

// Attempt to discard first card
const cardToDiscard = current.hand.slice(0, 1);
if (game.discardCards(current.id, cardToDiscard)) {
  console.log(`${current.name} discards ${cardToDiscard[0].value}${cardToDiscard[0].suit}`);
} else {
  console.log("❌ Invalid discard");
}

// Move to next turn
game.nextTurn();
const nextPlayer = game.getCurrentPlayer();
console.log(`\n➡️ Next player: ${nextPlayer.name}`);
