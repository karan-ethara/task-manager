import { Project } from '../models/project.model.js';
import { Task } from '../models/task.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

const projectPopulate = [
  { path: 'createdBy', select: 'name email role' },
  { path: 'team', select: 'name lead', populate: { path: 'lead', select: 'name email role profileStatus' } },
  { path: 'members', select: 'name email role' }
];

const resolveProjectMembers = async (memberIds = [], teamId) => {
  const normalizedIds = [...new Set([...(memberIds || [])])];
  if (normalizedIds.length === 0) {
    const teamMembers = await User.find({ isActive: true, team: teamId, role: 'Member' }).select('_id');
    return teamMembers.map((member) => member._id);
  }
  const members = await User.find({ _id: { $in: normalizedIds }, isActive: true, team: teamId }).select('_id');

  if (members.length !== normalizedIds.length) {
    throw new AppError('One or more members are invalid or outside the team', 400);
  }

  return normalizedIds;
};

const getProjectScopeFilter = (user) => {
  if (user.role === 'Admin') return {};
  if (user.role === 'Team Lead') return user.team ? { team: user.team } : { _id: null };
  if (!user.team) return { _id: null };
  return { team: user.team };
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getProjectCompletionMeta = ({ project, totalTasks, completedTasks }) => {
  const completeByTasks = totalTasks > 0 && completedTasks === totalTasks;
  const progressPercent = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const nowDay = startOfDay(new Date());
  const deadlineDay = project.deadline ? startOfDay(project.deadline) : null;
  let health = 'On Track';
  if (deadlineDay && !completeByTasks) {
    if (deadlineDay < nowDay) health = 'Overdue';
    else {
      const inThreeDays = new Date(nowDay);
      inThreeDays.setDate(inThreeDays.getDate() + 3);
      if (deadlineDay <= inThreeDays) health = 'At Risk';
    }
  }

  return {
    progressPercent,
    completedByTasks: completeByTasks,
    derivedStatus: completeByTasks ? 'Completed' : totalTasks === 0 ? 'Planned' : 'In Progress',
    health
  };
};

export const createProject = catchAsync(async (req, res) => {
  let teamId = req.user.role === 'Admin' ? req.body.team : req.user.team;
  if (req.user.role === 'Admin' && !teamId && Array.isArray(req.body.members) && req.body.members.length > 0) {
    const firstMember = await User.findById(req.body.members[0]).select('team');
    teamId = firstMember?.team || null;
  }
  if (!teamId) throw new AppError('Team is required to create a project', 400);
  const memberIds = await resolveProjectMembers(req.body.members, teamId);

  const project = await Project.create({
    ...req.body,
    status: 'Planned',
    team: teamId,
    members: memberIds,
    createdBy: req.user._id
  });

  await project.populate(projectPopulate);
  sendSuccess(res, { statusCode: 201, message: 'Project created successfully', data: { project } });
});

export const getProjects = catchAsync(async (req, res) => {
  const filter = getProjectScopeFilter(req.user);

  // Search, pagination and sorting
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  if (req.query.q) {
    filter.title = { $regex: req.query.q, $options: 'i' };
  }
  if (req.query.status) {
    filter.status = req.query.status;
  }
  if (req.query.team && req.user.role === 'Admin') {
    filter.team = req.query.team;
  }
  if (req.query.deadlineFrom || req.query.deadlineTo) {
    filter.deadline = {};
    if (req.query.deadlineFrom) filter.deadline.$gte = new Date(req.query.deadlineFrom);
    if (req.query.deadlineTo) filter.deadline.$lte = new Date(req.query.deadlineTo);
  }

  const sort = req.query.sort || '-createdAt';

  const [projects, total] = await Promise.all([
    Project.find(filter).populate(projectPopulate).sort(sort).skip(skip).limit(limit),
    Project.countDocuments(filter)
  ]);

  const projectIds = projects.map((project) => project._id);
  const taskCounts = projectIds.length
    ? await Task.aggregate([
      {
        $match: {
          project: { $in: projectIds },
          ...(req.user.role === 'Member' ? { assignedTo: req.user._id } : {})
        }
      },
      { $group: { _id: { project: '$project', status: '$status' }, count: { $sum: 1 } } }
    ])
    : [];

  const taskCountMap = new Map();
  const completedCountMap = new Map();
  taskCounts.forEach(({ _id, count }) => {
    const key = String(_id.project);
    taskCountMap.set(key, (taskCountMap.get(key) || 0) + count);
    if (_id.status === 'Completed') {
      completedCountMap.set(key, (completedCountMap.get(key) || 0) + count);
    }
  });
  const projectsWithCounts = projects.map((project) => ({
    ...(() => {
      const total = taskCountMap.get(String(project._id)) || 0;
      const completed = completedCountMap.get(String(project._id)) || 0;
      const meta = getProjectCompletionMeta({ project, totalTasks: total, completedTasks: completed });
      return {
        ...project.toObject(),
        memberCount: project.members?.length || 0,
        taskCount: total,
        completedTaskCount: completed,
        progressPercent: meta.progressPercent,
        health: meta.health,
        status: meta.derivedStatus
      };
    })()
  }));

  sendSuccess(res, {
    message: 'Projects fetched successfully',
    data: { projects: projectsWithCounts, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  });
});

export const getProject = catchAsync(async (req, res) => {
  const filter = { ...getProjectScopeFilter(req.user), _id: req.params.id };

  const project = await Project.findOne(filter).populate(projectPopulate);
  if (!project) throw new AppError('Project not found', 404);

  const tasks = await Task.find({ project: project._id })
    .find(req.user.role === 'Member' ? { assignedTo: req.user._id } : {})
    .populate('assignedTo', 'name email role')
    .populate('createdBy', 'name email role')
    .sort({ dueDate: 1 });
  const recentUpdates = await Task.find({ project: project._id })
    .populate('assignedTo', 'name')
    .sort({ updatedAt: -1 })
    .limit(6)
    .select('title status updatedAt assignedTo');

  const completedTasks = tasks.filter((task) => task.status === 'Completed').length;
  const meta = getProjectCompletionMeta({ project, totalTasks: tasks.length, completedTasks });

  sendSuccess(res, {
    message: 'Project details fetched successfully',
    data: {
      project: {
        ...project.toObject(),
        memberCount: project.members?.length || 0,
        taskCount: tasks.length,
        completedTaskCount: completedTasks,
        progressPercent: meta.progressPercent,
        health: meta.health,
        status: meta.derivedStatus
      },
      tasks,
      recentUpdates
    }
  });
});

export const updateProject = catchAsync(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ...getProjectScopeFilter(req.user) });
  if (!project) throw new AppError('Project not found', 404);

  let targetTeamId = project.team;
  if (typeof req.body.team !== 'undefined') {
    if (req.user.role !== 'Admin') {
      throw new AppError('Only Admin can change project team', 403);
    }
    if (!req.body.team) {
      throw new AppError('Team is required', 400);
    }
    targetTeamId = req.body.team;
    project.team = req.body.team;
  }

  if (typeof req.body.title !== 'undefined') project.title = req.body.title;
  if (typeof req.body.description !== 'undefined') project.description = req.body.description;
  // Project status is task-driven and not manually editable.
  if (typeof req.body.deadline !== 'undefined') project.deadline = req.body.deadline || null;
  if (typeof req.body.members !== 'undefined') {
    project.members = await resolveProjectMembers(req.body.members, targetTeamId);
  } else if (typeof req.body.team !== 'undefined') {
    // If team changes and members are not explicitly provided, reset to all members of the target team.
    project.members = await resolveProjectMembers([], targetTeamId);
  }

  await project.save();
  await project.populate(projectPopulate);

  const [totalTasks, completedTasks] = await Promise.all([
    Task.countDocuments({ project: project._id }),
    Task.countDocuments({ project: project._id, status: 'Completed' })
  ]);
  const meta = getProjectCompletionMeta({ project, totalTasks, completedTasks });

  sendSuccess(res, {
    message: 'Project updated successfully',
    data: {
      project: {
        ...project.toObject(),
        taskCount: totalTasks,
        completedTaskCount: completedTasks,
        progressPercent: meta.progressPercent,
        health: meta.health,
        status: meta.derivedStatus
      }
    }
  });
});

export const deleteProject = catchAsync(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ...getProjectScopeFilter(req.user) });
  if (!project) throw new AppError('Project not found', 404);

  await Task.deleteMany({ project: project._id });
  await project.deleteOne();

  sendSuccess(res, { message: 'Project and related tasks deleted successfully', data: {} });
});

export const addMember = catchAsync(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ...getProjectScopeFilter(req.user) });
  if (!project) throw new AppError('Project not found', 404);

  const user = await User.findOne({ _id: req.body.memberId, team: project.team });
  if (!user || !user.isActive) throw new AppError('Member not found', 404);

  const updatedProject = await Project.findByIdAndUpdate(
    req.params.id,
    { $addToSet: { members: user._id } },
    { new: true }
  ).populate(projectPopulate);

  if (!updatedProject) throw new AppError('Project not found', 404);
  sendSuccess(res, { message: 'Member added successfully', data: { project: updatedProject } });
});

export const removeMember = catchAsync(async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, ...getProjectScopeFilter(req.user) });
  if (!project) throw new AppError('Project not found', 404);

  const activeTaskExists = await Task.exists({
    project: project._id,
    assignedTo: req.params.userId,
    status: { $in: ['Todo', 'In Progress'] }
  });

  if (activeTaskExists) {
    throw new AppError('Cannot remove member with active tasks. Reassign or complete their tasks first.', 400);
  }

  project.members = project.members.filter((member) => String(member) !== req.params.userId);
  await project.save();
  await project.populate(projectPopulate);

  sendSuccess(res, { message: 'Member removed successfully', data: { project } });
});
