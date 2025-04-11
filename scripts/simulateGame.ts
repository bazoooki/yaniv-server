
import { GameEngine, Player, Card } from "../game/gameEngine";

const players: Player[] = [
  { id: "p1", name: "Alice", hand: [], score: 0 },
  { id: "p2", name: "Bob", hand: [], score: 0 },
];

const game = new GameEngine(players);

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function findSet(hand: Card[]): Card[] | undefined {
  const grouped: Record<string, Card[]> = hand.reduce((acc, card) => {
    acc[card.value] = acc[card.value] || [];
    acc[card.value].push(card);
    return acc;
  }, {} as Record<string, Card[]>);

  return Object.values(grouped).find((group) => group.length >= 2);
}

function findSequence(hand: Card[]): Card[] | null {
  const grouped: Record<string, Card[]> = hand.reduce((acc, card) => {
    acc[card.suit] = acc[card.suit] || [];
    acc[card.suit].push(card);
    return acc;
  }, {} as Record<string, Card[]>);

  for (const suit of Object.keys(grouped)) {
    const sorted = grouped[suit].sort(
      (a, b) => game.cardValue(a.value) - game.cardValue(b.value)
    );

    let seq: Card[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prevVal = game.cardValue(seq[seq.length - 1].value);
      const currVal = game.cardValue(sorted[i].value);
      if (currVal === prevVal + 1) {
        seq.push(sorted[i]);
        if (seq.length >= 3) return seq;
      } else {
        seq = [sorted[i]];
      }
    }
  }

  return null;
}

async function playRound() {
  console.log("\n🎮 Starting new round...");
  game.startNewRound();

  while (game.roundActive) {
    const player = game.getCurrentPlayer();
    console.log(`\n🎯 ${player.name}'s turn`);

    await sleep(1000);

    const drawn = game.drawCard();
    player.hand.push(drawn);
    const total = game.calculatePoints(player.hand);
    console.log(`${player.name} draws ${drawn.value}${drawn.suit} [${total}]`);

    const set = findSet(player.hand);
    const seq = findSequence(player.hand);
    let cardToDiscard: Card[];

    if (set) {
      cardToDiscard = set;
    } else if (seq) {
      cardToDiscard = seq;
    } else {
      const highest = player.hand.reduce((a, b) =>
        game.cardValue(b.value) > game.cardValue(a.value) ? b : a
      );
      cardToDiscard = [highest];
    }

    if (game.discardCards(player.id, cardToDiscard)) {
      console.log(`${player.name} discards:`, cardToDiscard.map(c => `${c.value}${c.suit}`).join(" "));
    } else {
      console.log("❌ Invalid discard");
    }

    
    if (total <= 7) {
      console.log(`${player.name} declares YANIV with ${total} points!`);
      const result = game.declareYaniv(player.id);
      console.log(`📢 Result: ${result.result.toUpperCase()}`);
      for (const [id, score] of Object.entries(result.scores)) {
        const p = players.find((p) => p.id === id);
        console.log(`${p?.name}: ${score} pts`);
      }
      break;
    }

    game.nextTurn();
  }
}

async function playUntilGameOver() {
  let round = 1;
  while (Math.max(...players.map((p) => p.score)) < 100) {
    console.log(`\n🌀 Round ${round++}`);
    await playRound();
  }

  const winner = players.reduce((acc, p) => (p.score < acc.score ? p : acc), players[0]);
  console.log(`\n🏆 GAME OVER! Winner: ${winner.name} (${winner.score} pts)`);
}

playUntilGameOver();