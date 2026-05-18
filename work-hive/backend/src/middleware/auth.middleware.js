import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { catchAsync } from '../utils/catchAsync.js';

export const protect = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (header && !header.startsWith('Bearer ')) {
    throw new AppError('Invalid authorization header format', 401);
  }

  const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) throw new AppError('Missing authentication token', 401);

  let decoded;
  try {
    decoded = jwt.verify(token, env.jwtSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token expired', 401);
    }
    throw new AppError('Invalid token', 401);
  }

  const user = await User.findById(decoded.id).select('-password');

  if (!user || !user.isActive) throw new AppError('Unauthorized access', 401);

  req.user = user;
  next();
});

export const restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};
