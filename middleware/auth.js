// Simple session middleware — extend with JWT later if needed
const requireAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  const role   = req.headers['x-user-role'];
  if (!userId || !role) {
    return res.status(401).json({ error: 'Unauthorized — please login.' });
  }
  req.userId = userId;
  req.role   = role;
  next();
};

module.exports = { requireAuth };