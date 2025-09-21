import jwt from 'jsonwebtoken';

const ACCESS_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

export const signAccessToken = payload =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: '7d' });

export const signRefreshToken = payload =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: '7d' });

export const verifyAccessToken = token => jwt.verify(token, ACCESS_SECRET);
export const verifyRefreshToken = token => jwt.verify(token, REFRESH_SECRET);
