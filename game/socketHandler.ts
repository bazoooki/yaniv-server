// ✅ Final refactored socketHandler.ts with updated YANIV rule (≤5 and only on player's turn)
import { Server, Socket } from "socket.io";
import { GameManager } from "./gameManager";
import { Player } from "./gameEngine";

export const setupSocketHandlers = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log("🟢 Connected:", socket.id);

    socket.on("joinRoom", ({ roomId, player }) => {
        console.log("🟢 Join Room request:", roomId, socket.id, player);
      socket.join(roomId);
      const game = GameManager.getGame(roomId);
      
      if (game) {
        if (!game.players.find((p) => p.id === player.id)) {
          game.players.push({ ...player, ready: false });
        }
      } else {
        GameManager.createGame(roomId, [{ ...player, ready: false }], io);
      }
      console.log("🟢 Game:", {game} );
      const updatedPlayers = GameManager.getGame(roomId)?.players || [];
      io.to(roomId).emit("playerJoined", { players: updatedPlayers });
    });

    socket.on("playerReady", ({ roomId, playerId }) => {
      const game = GameManager.getGame(roomId);
      if (!game) return;

      const player = game.players.find((p) => p.id === playerId);
      if (player) player.ready = true;

      const allReady = game.players.length >= 2 && game.players.every((p) => !!p?.ready);

      io.to(roomId).emit("playerReadyStatus", {
        players: game.players.map((p) => ({ id: p.id, ready: !!p.ready })),
      });

      if (allReady && !game.engine.roundActive) {
        startGame(roomId, game, io);
      }
    });

    socket.on("drawCard", ({ roomId, playerId }) => {
      const game = GameManager.getGame(roomId);
      if (!game || !game.engine.roundActive) return;

      const player = game.engine.players.find((p) => p.id === playerId);
      if (!player) return;

      const card = game.engine.drawCard();
      player.hand.push(card);

      io.to(roomId).emit("cardDrawn", {
        playerId,
        card,
        hand: player.hand,
      });
      emitPlayerStates(roomId, game, io);
    });

    socket.on("playerAction", ({ roomId, playerId, discard }) => {
  
        
      const game = GameManager.getGame(roomId);

      if (!game?.engine.getCurrentPlayer()) {
        console.warn("⚠️ No valid current player. Game might be stuck.");
      }


      if (!game || !game.engine.roundActive) return;
      if (!Array.isArray(discard) || discard.length === 0) return;

      const success = game.engine.discardCards(playerId, discard);
      if (!success) return;

      const hand = game.engine.players.find((p) => p.id === playerId)?.hand;

      io.to(roomId).emit("playerDiscarded", {
        playerId,
        discard,
        hand,
      });
      emitPlayerStates(roomId, game, io);
      
      game.engine.nextTurn();
      startTurnTimer(roomId, game.engine, io);

      console.log("✅ playerAction complete for:", playerId);
      console.log("➡️ Calling nextTurn()");
    });

    socket.on("declareYaniv", ({ roomId, playerId }) => {
      const game = GameManager.getGame(roomId);
      if (!game || game.hasDeclaredYaniv) return;

      const currentPlayer = game.engine.getCurrentPlayer();
      if (currentPlayer.id !== playerId) return; // ❌ Not your turn

      const total = game.engine.calculatePoints(currentPlayer.hand);
      if (total > 5) return; // ❌ Too many points

      game.hasDeclaredYaniv = true;
      const result = game.engine.declareYaniv(playerId);
      io.to(roomId).emit("yanivDeclared", result);
      io.to(roomId).emit("roundCountdown", { seconds: 15 });
      //emitPlayerStates(roomId, game, io);

      setTimeout(() => {
        game.hasDeclaredYaniv = false;
        game.engine.startNewRound();

        io.to(roomId).emit("gameStarted", {
          players: game.players,
          discardTop: game.engine.discardPile.at(-1),
          deckCount: game.engine.deck.length,
        });
        startTurnTimer(roomId, game.engine, io);
        emitPlayerStates(roomId, game, io);
      }, 15000);
    });

    socket.on("sendMessage", ({ roomId, sender, text }) => {
      const message = {
        sender,
        text,
        timestamp: Date.now(),
      };
      io.to(roomId).emit("receiveMessage", message);
    });

    socket.on("reconnectToRoom", ({ roomId, playerId }) => {
      const game = GameManager.getGame(roomId);
      if (!game) return;

      const player = game.players.find((p) => p.id === playerId);
      if (player) {
        socket.join(roomId);
        io.to(socket.id).emit("restoreState", {
          player,
          players: game.players,
          discardPile: game.engine.discardPile,
          yourTurn: game.engine.getCurrentPlayer().id === playerId,
        });
        io.to(roomId).emit("playerReconnected", { playerId });
      }
    });
    

    socket.on("disconnect", () => {
      console.log("🔴 Disconnected:", socket.id);
    });
  });
};

function startGame(roomId: string, game: any, io: Server) {
  game.hasDeclaredYaniv = false;
  game.engine.startNewRound();

  io.to(roomId).emit("gameStarted", {
    players: game.players,
    discardTop: game.engine.discardPile.at(-1),
    deckCount: game.engine.deck.length,
  });
  startTurnTimer(roomId, game.engine, io);
}
function emitPlayerStates(roomId: string, game: any, io: Server) {
  const playerStates = game.engine.players.map((p:Player) => ({
    id: p.id,
    name: p.name,
    handSize: p.hand.length,
    score: p.score,
  }));
  io.to(roomId).emit("playerStateUpdate", playerStates);
}
function startTurnTimer(roomId: string, engine: any, io: Server) {
  console.log("➡️ Next turn:", engine.getCurrentPlayer()?.id);
  const player = engine.getCurrentPlayer();
  if (!player || !player.hand.length) return;

  io.to(roomId).emit("playerTurn", {
    playerId: player.id,
    name: player.name,
  });
}
