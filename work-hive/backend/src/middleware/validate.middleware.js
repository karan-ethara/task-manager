import { AppError } from '../utils/AppError.js';

export const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const message = error.details.map((item) => item.message).join(', ');
    const details = error.details.map((item) => ({ field: item.path.join('.'), message: item.message }));
    const appErr = new AppError(message, 400);
    appErr.errors = details;
    return next(appErr);
  }

  req.body = value;
  next();
};
