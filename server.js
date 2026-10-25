const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

io.on("connection", (socket) => {
  socket.on("room:join", ({ roomId, name }) => {
    if (!roomId || !name) return;
    const rooms = io.sockets.adapter.rooms;
    const existing = rooms.get(roomId);
    const members = existing ? [...existing] : [];
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.name = String(name).slice(0, 28);
    socket.emit("room:joined", {
      roomId,
      selfId: socket.id,
      participants: members.map((id) => ({
        id,
        name: io.sockets.sockets.get(id)?.data.name || "Participante"
      }))
    });
    socket.to(roomId).emit("participant:joined", {
      id: socket.id,
      name: socket.data.name
    });
  });

  socket.on("webrtc:offer", ({ to, offer }) => io.to(to).emit("webrtc:offer", {
    from: socket.id, name: socket.data.name, offer
  }));
  socket.on("webrtc:answer", ({ to, answer }) => io.to(to).emit("webrtc:answer", {
    from: socket.id, answer
  }));
  socket.on("webrtc:ice", ({ to, candidate }) => io.to(to).emit("webrtc:ice", {
    from: socket.id, candidate
  }));
  socket.on("participant:rename", ({ name }) => {
    socket.data.name = String(name || "Participante").slice(0, 28);
    if (socket.data.roomId) io.to(socket.data.roomId).emit("participant:renamed", {
      id: socket.id, name: socket.data.name
    });
  });
  socket.on("disconnect", () => {
    if (socket.data.roomId) io.to(socket.data.roomId).emit("participant:left", {
      id: socket.id
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Intense rodando em http://localhost:${PORT}`));
