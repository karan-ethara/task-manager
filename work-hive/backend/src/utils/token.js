import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const signToken = (userId) =>
  jwt.sign({ id: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
