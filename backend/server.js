const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Basic API check route
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Allow connections from any frontend origin for local testing
    methods: ['GET', 'POST']
  }
});

// In-memory room store: roomId -> Array of { socketId, userName }
const rooms = {};

io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // 1. Join Room Handler
  socket.on('join-room', ({ roomId, userName, roomName }) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        name: roomName || `Cinema #${roomId}`,
        creator: userName,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        users: []
      };
    }

    // Add user if not already in list
    if (!rooms[roomId].users.some(u => u.socketId === socket.id)) {
      rooms[roomId].users.push({ socketId: socket.id, userName });
    }

    const currentUsers = rooms[roomId].users.map(u => u.userName);
    console.log(`[Room Joined] User "${userName}" joined Room "${roomId}" (${rooms[roomId].name}). Active users: [${currentUsers.join(', ')}]`);

    // Broadcast to room members that a new user joined
    io.to(roomId).emit('user-joined', {
      userName,
      users: currentUsers,
      roomName: rooms[roomId].name,
      creator: rooms[roomId].creator,
      createdAt: rooms[roomId].createdAt
    });
  });

  // 2. Play Sync Handler
  socket.on('play', (data) => {
    const { roomId } = socket;
    if (roomId) {
      console.log(`[Sync Event] Play emitted in room ${roomId} at time ${data.time} by ${data.userName}`);
      socket.to(roomId).emit('play', data);
    }
  });

  // 3. Pause Sync Handler
  socket.on('pause', (data) => {
    const { roomId } = socket;
    if (roomId) {
      console.log(`[Sync Event] Pause emitted in room ${roomId} at time ${data.time} by ${data.userName}`);
      socket.to(roomId).emit('pause', data);
    }
  });

  // 4. Seek Sync Handler
  socket.on('seek', (data) => {
    const { roomId } = socket;
    if (roomId) {
      console.log(`[Sync Event] Seek emitted in room ${roomId} to time ${data.time} by ${data.userName}`);
      socket.to(roomId).emit('seek', data);
    }
  });

  // 5. Chat Message Relay
  socket.on('chat-message', (data) => {
    const { roomId } = socket;
    if (roomId) {
      console.log(`[Chat Message] Received from ${data.user} in room ${roomId}: "${data.text}"`);
      // Broadcast to other users in the room
      socket.to(roomId).emit('chat-message', data);
    }
  });

  // 6. User Leaves Room Explicitly
  socket.on('leave-room', () => {
    handleUserExit(socket);
  });

  // 7. Socket Disconnect
  socket.on('disconnect', () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    handleUserExit(socket);
  });
});

// Helper function to handle cleaning up users from rooms
function handleUserExit(socket) {
  const { roomId, userName } = socket;
  if (roomId && rooms[roomId]) {
    // Remove user
    rooms[roomId].users = rooms[roomId].users.filter(u => u.socketId !== socket.id);
    
    const currentUsers = rooms[roomId].users.map(u => u.userName);
    console.log(`[Room Left] User "${userName}" left Room "${roomId}". Remaining users: [${currentUsers.join(', ')}]`);

    // Notify remaining users
    socket.to(roomId).emit('user-left', {
      userName,
      users: currentUsers.length > 0 ? currentUsers : ['You']
    });

    // Clean up empty room
    if (rooms[roomId].users.length === 0) {
      delete rooms[roomId];
      console.log(`[Room Deleted] Room "${roomId}" is now empty.`);
    }
  }
}

const path = require('path');
const fs = require('fs');

// Serve frontend static assets from 'frontend/dist' if they exist
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// For all other routes, send back the index.html from dist
app.get('*', (req, res) => {
  const indexPath = path.join(frontendDistPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.json({ 
      status: 'healthy', 
      message: 'SyncCinema backend server is running! Build the frontend (npm run build) to serve it from here.',
      timestamp: new Date() 
    });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`SyncCinema backend server listening on port ${PORT}`);
});
