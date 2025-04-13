import { Server, Socket } from "socket.io";
import { GameManager } from "./gameManager";
import { Player } from "./gameEngine";

const disconnectedPlayers = new Map<string, NodeJS.Timeout>();
const countdownTimers = new Map<string, NodeJS.Timeout>();

export const setupSocketHandlers = (io: Server) => {
  GameManager.initializeDefaultRooms(io);

  io.on("connection", (socket: Socket) => {
    const playerId = socket.handshake.query.playerId as string;
    console.log("🟢 Connected:", socket.id);

    // Handle reconnection
    if (playerId && disconnectedPlayers.has(playerId)) {
      clearTimeout(disconnectedPlayers.get(playerId)!);
      disconnectedPlayers.delete(playerId);
      console.log(`🔁 ${playerId} reconnected`);
    }

    socket.on("requestAvailableRooms", (_, callback) => {
      const rooms = GameManager.getAvailableRooms();
      callback?.({
        rooms: rooms.map(roomId => {
          const game = GameManager.getGame(roomId);
          return {
            id: roomId,
            mode: game?.mode || "classic",
            multiplier: game?.multiplier || 1,
            minChips: (game?.multiplier || 1) * 100,
          };
        }),
      });
    });

    socket.on("joinRoom", ({ roomId, player }) => {
      socket.join(roomId);
      const game = GameManager.getGame(roomId);
        if (!game) {
            socket.emit("joinDenied", { reason: "Room not found" });
            return;
        }
      // Spectator if room is full
      if (game?.players.length >= 4) {
        socket.emit("spectatorMode", {
          fullRoom: true,
          message: "Room is full. You are now spectating.",
        });
        return;
      }

      // Spectator if mid-game
      if (game?.engine.roundActive) {
        socket.emit("spectatorMode", {
          roomId,
          discardTop: game.engine.discardPile.at(-1),
          deckCount: game.engine.deck.length,
          players: game.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            chips: p.chips ?? 0,
            handSize: p.hand?.length || 0,
          })),
        });
        return;
      }

      if (typeof player.chips !== 'number') {
        player.chips = player.chips ?? 1000;
      }

      const minChips = game?.mode === "fast" ? (game?.multiplier || 1) * 100 : 0;
      if (player.chips < minChips) {
        socket.emit("joinDenied", { reason: `Not enough chips. Minimum required: ${minChips}` });
        return;
      }

      if (game) {
        if (!game.players.some(p => p.id === player.id)) {
          game.players.push({ ...player, ready: false });
        }
      } else {
        GameManager.createGame(roomId, [{ ...player, ready: false }], io);
      }

      const players = GameManager.getGame(roomId)?.players || [];
      io.to(roomId).emit("playerJoined", { players });

      if (players.length < 2) {
        io.to(roomId).emit("waitingForPlayers", { roomId });
      }
    });

    socket.on("playerReady", ({ roomId, playerId }) => {
      const game = GameManager.getGame(roomId);
      if (!game) return;

      const player = game.players.find(p => p.id === playerId);
      if (player) player.ready = true;

      io.to(roomId).emit("playerReadyStatus", {
        players: game.players.map(p => ({ id: p.id, ready: !!p.ready })),
      });

      const allReady = game.players.length >= 2 && game.players.every(p => p.ready);
      if (allReady && !game.engine.roundActive) {
        triggerCountdown(roomId, game, io);
      }
    });

    socket.on("playerMove", ({ roomId, playerId, discard, drawSource }) => {
      const game = GameManager.getGame(roomId);
      if (!game || !game.engine.roundActive) return;

      const drawnCard = game.engine.performMove(playerId, discard, drawSource);
      if (!drawnCard) return;

      const player = game.engine.players.find(p => p.id === playerId);
      io.to(roomId).emit("playerMoved", {
        playerId,
        discard,
        hand: player?.hand,
        drawnCard,
      });

      emitPlayerStates(roomId, game, io);
      game.engine.nextTurn();
      startTurnTimer(roomId, game.engine, io);
    });

    socket.on("declareYaniv", ({ roomId, playerId }) => {
      const game = GameManager.getGame(roomId);
      if (!game || game.hasDeclaredYaniv) return;

      const currentPlayer = game.engine.getCurrentPlayer();
      if (currentPlayer.id !== playerId) return;

      const total = game.engine.calculatePoints(currentPlayer.hand);
      if (total > 5) return;

      game.hasDeclaredYaniv = true;
      const multiplier = game.multiplier ?? 1;

      const result = game.engine.declareYaniv(playerId, multiplier);

      if (result.chipResults) {
        for (const [id, delta] of Object.entries(result.chipResults)) {
          const p = game.players.find(p => p.id === id);
          if (p) {
            p.chips = (p.chips || 0) + delta;
          }
        }
        emitPlayerStates(roomId, game, io);
      }

      io.to(roomId).emit("yanivDeclared", result);
      io.to(roomId).emit("roundCountdown", { seconds: 15 });

      setTimeout(() => {
        game.hasDeclaredYaniv = false;
        game.engine.startNewRound();

        io.to(roomId).emit("gameStarted", {
          players: game.players,
          discardTop: game.engine.discardPile.at(-1),
          deckCount: game.engine.deck.length,
        });

        emitPlayerStates(roomId, game, io);
        startTurnTimer(roomId, game.engine, io);
      }, 15000);
    });
    socket.on("chatMessage", ({ roomId, from, message }) => {
        io.to(roomId).emit("chatMessage", { from, message });
    });

    socket.on("disconnect", () => {
      console.log("🔴 Disconnected:", socket.id);
      for (const roomId of socket.rooms) {
        const game = GameManager.getGame(roomId);
        if (!game) continue;

        const player = game.players.find(p => p.id === playerId);
        if (!player) continue;

        disconnectedPlayers.set(playerId, setTimeout(() => {
          game.players = game.players.filter(p => p.id !== playerId);
          io.to(roomId).emit("playerLeft", { playerId });
          console.log(`⏱️ Removed player ${playerId} from ${roomId}`);
        }, 60000));
      }
    });
  });
};

function triggerCountdown(roomId: string, game: any, io: Server) {
  if (countdownTimers.has(roomId)) {
    clearTimeout(countdownTimers.get(roomId)!);
  }

  io.to(roomId).emit("countdownToStart", { seconds: 15 });
  const timeout = setTimeout(() => startGame(roomId, game, io), 15000);
  countdownTimers.set(roomId, timeout);
}

function startGame(roomId: string, game: any, io: Server) {
  game.hasDeclaredYaniv = false;
  game.engine.startNewRound();
  io.to(roomId).emit("gameStarted", {
    players: game.players,
    discardTop: game.engine.discardPile.at(-1),
    deckCount: game.engine.deck.length,
  });
  emitPlayerStates(roomId, game, io);
  startTurnTimer(roomId, game.engine, io);
}

function emitPlayerStates(roomId: string, game: any, io: Server) {
  const playerStates = game.engine.players.map((p: Player) => ({
    id: p.id,
    name: p.name,
    handSize: p.hand.length,
    score: p.score,
    chips: p.chips || 0,
  }));
  io.to(roomId).emit("playerStateUpdate", playerStates);
}

function startTurnTimer(roomId: string, engine: any, io: Server) {
  const player = engine.getCurrentPlayer();
  if (player) {
    io.to(roomId).emit("playerTurn", { playerId: player.id, name: player.name });
  }
}
