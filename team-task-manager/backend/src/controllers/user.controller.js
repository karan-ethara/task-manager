import { User } from '../models/user.model.js';
import { Team } from '../models/team.model.js';
import { Task } from '../models/task.model.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

const cleanUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  team: user.team || null,
  profileStatus: user.profileStatus,
  isActive: user.isActive,
  createdAt: user.createdAt
});

const canAccessProfile = (actor, target) => {
  if (actor.role === 'Admin') return true;
  if (String(actor._id) === String(target._id)) return true;
  if (!actor.team || !target.team) return false;
  return String(actor.team) === String(target.team);
};

export const getUsers = catchAsync(async (req, res) => {
  const filter = req.user.role === 'Admin' ? {} : { team: req.user.team };
  if (req.query.q) {
    const q = req.query.q.trim();
    filter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
  }
  if (req.query.role) filter.role = req.query.role;
  if (req.query.status) filter.profileStatus = req.query.status;
  if (req.query.team && req.user.role === 'Admin') filter.team = req.query.team;

  const sortMap = {
    name_asc: { name: 1 },
    name_desc: { name: -1 },
    joined_desc: { createdAt: -1 },
    joined_asc: { createdAt: 1 }
  };
  const sort = sortMap[req.query.sort] || { name: 1 };

  const users = await User.find(filter)
    .populate('team', 'name')
    .select('name email role team profileStatus isActive createdAt')
    .sort(sort);

  const workloadAgg = await Task.aggregate([
    { $match: { assignedTo: { $in: users.map((u) => u._id) } } },
    {
      $group: {
        _id: '$assignedTo',
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        openTasks: { $sum: { $cond: [{ $in: ['$status', ['Todo', 'In Progress']] }, 1, 0] } }
      }
    }
  ]);
  const workloadMap = new Map(workloadAgg.map((w) => [String(w._id), w]));

  sendSuccess(res, {
    message: 'Users fetched successfully',
    data: {
      users: users.map((u) => ({
        ...u.toObject(),
        workload: workloadMap.get(String(u._id)) || { totalTasks: 0, completedTasks: 0, openTasks: 0 }
      }))
    }
  });
});

export const createUser = catchAsync(async (req, res) => {
  const exists = await User.findOne({ email: req.body.email });
  if (exists) throw new AppError('Email already in use', 409);

  if (req.user.role === 'Team Lead') {
    if (!req.user.team) throw new AppError('Team Lead is not assigned to any team', 400);
    if (req.body.role === 'Admin' || req.body.role === 'Team Lead') {
      throw new AppError('Team Lead can create members only', 403);
    }
  }

  const payload = {
    ...req.body,
    team: req.user.role === 'Admin' ? req.body.team || null : req.user.team,
    role: req.user.role === 'Admin' ? req.body.role : 'Member'
  };

  if (payload.role === 'Team Lead') {
    if (!payload.team) throw new AppError('Team Lead must belong to a team', 400);
    const existingLead = await User.findOne({ team: payload.team, role: 'Team Lead' });
    if (existingLead) throw new AppError('This team already has a Team Lead', 400);
    const existingTeam = await Team.findById(payload.team);
    if (!existingTeam) throw new AppError('Team not found', 404);
  }

  const user = await User.create(payload);
  sendSuccess(res, { statusCode: 201, message: 'User created successfully', data: { user: cleanUser(user) } });
});

export const updateUser = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);

  const isSelf = String(req.user._id) === String(user._id);
  if (req.user.role !== 'Admin' && String(user.team) !== String(req.user.team)) {
    throw new AppError('You do not have permission to update this user', 403);
  }
  if (req.user.role !== 'Admin' && typeof req.body.isActive === 'boolean') {
    throw new AppError('Only Admin can activate or deactivate user accounts', 403);
  }
  if (req.user.role !== 'Admin' && (typeof req.body.email !== 'undefined' || typeof req.body.password !== 'undefined')) {
    throw new AppError('Only Admin can update email or password', 403);
  }
  if (req.body.isActive === false && isSelf) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  if (req.body.name) user.name = req.body.name;
  if (req.body.profileStatus) user.profileStatus = req.body.profileStatus;
  if (req.user.role === 'Admin') {
    const nextRole = req.body.role || user.role;
    const nextTeam = typeof req.body.team !== 'undefined' ? req.body.team || null : user.team;
    if (nextRole === 'Team Lead') {
      if (!nextTeam) throw new AppError('Team Lead must belong to a team', 400);
      const existingLead = await User.findOne({ _id: { $ne: user._id }, team: nextTeam, role: 'Team Lead' });
      if (existingLead) throw new AppError('This team already has a Team Lead', 400);
      const existingTeam = await Team.findById(nextTeam);
      if (!existingTeam) throw new AppError('Team not found', 404);
    }
    if (req.body.role) user.role = req.body.role;
    if (typeof req.body.isActive === 'boolean') user.isActive = req.body.isActive;
    if (typeof req.body.team !== 'undefined') user.team = req.body.team || null;
    if (typeof req.body.email !== 'undefined') {
      const normalizedEmail = String(req.body.email).trim().toLowerCase();
      if (!normalizedEmail) throw new AppError('Email is required', 400);
      const exists = await User.findOne({ _id: { $ne: user._id }, email: normalizedEmail });
      if (exists) throw new AppError('Email already in use', 409);
      user.email = normalizedEmail;
    }
    if (typeof req.body.password !== 'undefined') {
      user.password = req.body.password;
    }
  }

  await user.save();
  sendSuccess(res, { message: 'User updated successfully', data: { user: cleanUser(user) } });
});

export const deleteUser = catchAsync(async (req, res) => {
  if (req.user.role !== 'Admin') {
    throw new AppError('Only Admin can deactivate user accounts', 403);
  }

  const user = await User.findById(req.params.id);
  if (!user) throw new AppError('User not found', 404);
  if (String(req.user._id) === String(user._id)) {
    throw new AppError('You cannot deactivate your own account', 400);
  }

  // Soft-delete: mark inactive
  user.isActive = false;
  await user.save();

  sendSuccess(res, { message: 'User deactivated successfully', data: { user: cleanUser(user) } });
});

export const updateMyStatus = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw new AppError('User not found', 404);
  user.profileStatus = req.body.profileStatus;
  await user.save();
  sendSuccess(res, { message: 'Profile status updated successfully', data: { user: cleanUser(user) } });
});

export const getUserProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.params.id).populate('team', 'name');
  if (!user || !user.isActive) throw new AppError('User not found', 404);
  if (!canAccessProfile(req.user, user)) {
    throw new AppError('You do not have permission to access this profile', 403);
  }

  const [workload] = await Task.aggregate([
    { $match: { assignedTo: user._id } },
    {
      $group: {
        _id: '$assignedTo',
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
        openTasks: { $sum: { $cond: [{ $in: ['$status', ['Todo', 'In Progress']] }, 1, 0] } }
      }
    }
  ]);

  sendSuccess(res, {
    message: 'Profile fetched successfully',
    data: {
      profile: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        team: user.team ? { id: user.team._id, name: user.team.name } : null,
        profileStatus: user.profileStatus,
        createdAt: user.createdAt,
        workload: workload || { totalTasks: 0, completedTasks: 0, openTasks: 0 }
      }
    }
  });
});
