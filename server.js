var io = require('socket.io')();

// Wait for a connection.
io.on('connection', function(socket) {
  // Listen for a score update.
  socket.on('score', function(msg) {
    io.emit('score', msg);
  });
});

io.listen(2000);