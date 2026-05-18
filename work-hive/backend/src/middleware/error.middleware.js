import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

const formatValidationErrors = (error) => Object.values(error.errors || {}).map((item) => ({
  field: item.path,
  message: item.message
}));

const normalizeError = (error) => {
  if (error instanceof AppError) return error;

  if (error.name === 'CastError') {
    return new AppError(`Invalid ${error.path}`, 400);
  }

  if (error.name === 'ValidationError') {
    const appError = new AppError('Validation failed', 400);
    appError.errors = formatValidationErrors(error);
    return appError;
  }

  if (error.code === 11000) {
    const duplicateField = Object.keys(error.keyValue || {})[0] || 'field';
    const duplicateValue = error.keyValue?.[duplicateField];
    const appError = new AppError(
      duplicateField === 'email'
        ? 'Email is already registered'
        : `${duplicateField} must be unique`,
      409
    );
    appError.errors = [
      {
        field: duplicateField,
        message: duplicateValue
          ? `${duplicateField} "${duplicateValue}" already exists`
          : `${duplicateField} already exists`
      }
    ];
    return appError;
  }

  if (error.name === 'JsonWebTokenError') {
    return new AppError('Invalid token', 401);
  }

  if (error.name === 'TokenExpiredError') {
    return new AppError('Token expired', 401);
  }

  return error;
};

export const errorHandler = (err, req, res, next) => {
  const error = normalizeError(err);
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal server error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.nodeEnv === 'development' && { stack: err.stack }),
    ...(error.errors && { errors: error.errors })
  });
};
