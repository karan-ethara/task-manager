export const sendSuccess = (res, { statusCode = 200, message = 'Action completed successfully', data = {} } = {}) =>
  res.status(statusCode).json({
    success: true,
    message,
    data
  });

