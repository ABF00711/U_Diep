// JWT secret - use env in production
const JWT_SECRET = process.env.JWT_SECRET || 'justice00711';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

module.exports = { JWT_SECRET, JWT_EXPIRES_IN };
