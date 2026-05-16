import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';
import { signToken } from '../utils/token.js';

const cleanUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  team: user.team || null,
  profileStatus: user.profileStatus,
  createdAt: user.createdAt
});

export const signup = catchAsync(async (req, res) => {
  const exists = await User.findOne({ email: req.body.email });
  if (exists) throw new AppError('Email is already registered', 409);

  const user = await User.create({ ...req.body, role: 'Member' });
  const token = signToken(user._id);

  sendSuccess(res, {
    statusCode: 201,
    message: 'Account created successfully',
    data: { token, user: cleanUser(user) }
  });
});

export const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = signToken(user._id);
  sendSuccess(res, {
    message: 'Login successful',
    data: { token, user: cleanUser(user) }
  });
});

export const me = catchAsync(async (req, res) => {
  sendSuccess(res, {
    message: 'User profile fetched successfully',
    data: { user: cleanUser(req.user) }
  });
});
