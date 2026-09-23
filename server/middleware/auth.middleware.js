const jwt = require('jsonwebtoken');

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'markops_super_secret_access_key_2026';

/**
 * Express Middleware to authenticate JWT Access Tokens and verify active status.
 */
function authenticateJwt(dbUsersStoreGetter) {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Missing or malformed Authorization header.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);

      if (dbUsersStoreGetter) {
        const users = dbUsersStoreGetter();
        const foundUser = users.find((u) => u.id === decoded.sub || u.email === decoded.email);
        if (foundUser && foundUser.isActive === false) {
          return res.status(403).json({ error: 'Account is inactive. Access denied by authorization middleware.' });
        }
      }

      req.user = {
        id: decoded.sub,
        email: decoded.email,
        role: decoded.role,
        isActive: decoded.isActive !== false,
      };

      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired access token.', details: err.message });
    }
  };
}

/**
 * Express Middleware to restrict route access to specific user roles.
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!req.user.isActive) {
      return res.status(403).json({ error: 'Inactive user accounts cannot perform this action.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized for this resource. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    return next();
  };
}

module.exports = {
  authenticateJwt,
  requireRole,
  JWT_ACCESS_SECRET,
};
