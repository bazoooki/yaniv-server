


import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./game/socketHandler";
;



const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
      origin: "*", // ✅ or specific origin: "http://localhost:3000"
      methods: ["GET", "POST"],
    },
  });

setupSocketHandlers(io);

server.listen(8080, () => {
  console.log("🚀 WebSocket server running on http://localhost:8080");
});
