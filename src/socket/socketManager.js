const connections = new Map();

export const addConnection = (userId, socketId) => {
  if (!userId) return;

  const sockets = connections.get(userId) ?? new Set();
  sockets.add(socketId);
  connections.set(userId, sockets);
};

export const removeConnection = (userId, socketId) => {
  if (!userId) return;

  const sockets = connections.get(userId);
  if (!sockets) return;

  sockets.delete(socketId);

  if (sockets.size === 0) {
    connections.delete(userId);
  }
};

export const getUserSockets = (userId) => connections.get(userId) ?? new Set();

export const isOnline = (userId) => getUserSockets(userId).size > 0;

export default {
  addConnection,
  removeConnection,
  getUserSockets,
  isOnline,
};
