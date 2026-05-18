import { Project } from '../models/project.model.js';
import { Task } from '../models/task.model.js';
import { User } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

const taskPopulate = [
  { path: 'project', select: 'title status members team' },
  { path: 'team', select: 'name lead' },
  { path: 'assignedTo', select: 'name email role' },
  { path: 'createdBy', select: 'name email role' }
];

const getTaskAccessFilter = (user) => (
  user.role === 'Admin'
    ? {}
    : user.role === 'Team Lead'
      ? { team: user.team }
      : user.team ? { team: user.team } : { _id: null }
);

const syncProjectCompletionStatus = async (projectId) => {
  const [project, totalTasks, completedTasks] = await Promise.all([
    Project.findById(projectId),
    Task.countDocuments({ project: projectId }),
    Task.countDocuments({ project: projectId, status: 'Completed' })
  ]);
  if (!project) return;

  if (totalTasks > 0 && completedTasks === totalTasks) {
    if (project.status !== 'Completed') {
      project.status = 'Completed';
      await project.save();
    }
    return;
  }

  if (project.status === 'Completed') {
    project.status = totalTasks === 0 ? 'Planned' : 'In Progress';
    await project.save();
  }
};

const assertProjectAssignment = async ({ projectId, assignedTo, user: actor }) => {
  const [project, assignee] = await Promise.all([
    Project.findById(projectId),
    User.findById(assignedTo)
  ]);

  if (!project) throw new AppError('Project not found', 404);
  if (!assignee || !assignee.isActive) throw new AppError('Assigned user not found', 404);
  if (assignee.role !== 'Member') throw new AppError('Task can be assigned only to a member', 400);
  if (String(project.team) !== String(assignee.team)) {
    throw new AppError('Task assignment must stay within the same team', 400);
  }
  if (!project.members.map(String).includes(String(assignedTo))) {
    project.members.push(assignee._id);
    await project.save();
  }
  if (actor.role === 'Team Lead' && String(project.team) !== String(actor.team)) {
    throw new AppError('You can manage tasks only for your assigned team', 403);
  }

  return project;
};

export const createTask = catchAsync(async (req, res) => {
  const project = await assertProjectAssignment({ projectId: req.body.project, assignedTo: req.body.assignedTo, user: req.user });

  const task = await Task.create({ ...req.body, team: project.team, createdBy: req.user._id });
  await syncProjectCompletionStatus(project._id);
  await task.populate(taskPopulate);

  sendSuccess(res, { statusCode: 201, message: 'Task created successfully', data: { task } });
});

export const getTasks = catchAsync(async (req, res) => {
  const filter = getTaskAccessFilter(req.user);

  if (req.query.project) filter.project = req.query.project;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
  if (req.query.team && req.user.role === 'Admin') filter.team = req.query.team;
  if (req.query.dueDate) {
    const day = new Date(req.query.dueDate);
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);
    filter.dueDate = { $gte: day, $lt: nextDay };
  } else if (req.query.dueFrom || req.query.dueTo) {
    filter.dueDate = {};
    if (req.query.dueFrom) filter.dueDate.$gte = new Date(req.query.dueFrom);
    if (req.query.dueTo) filter.dueDate.$lte = new Date(req.query.dueTo);
  }

  // pagination, search and sorting
  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '50', 10)));
  const skip = (page - 1) * limit;

  if (req.query.q) {
    filter.title = { $regex: req.query.q, $options: 'i' };
  }

  const sort = req.query.sort || 'dueDate';

  const [tasks, total] = await Promise.all([
    Task.find(filter).populate(taskPopulate).sort(sort).skip(skip).limit(limit),
    Task.countDocuments(filter)
  ]);

  sendSuccess(res, {
    message: 'Tasks fetched successfully',
    data: { tasks, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } }
  });
});

export const getTask = catchAsync(async (req, res) => {
  const task = await Task.findById(req.params.id).populate(taskPopulate);
  if (!task) throw new AppError('Task not found', 404);
  if (req.user.role === 'Team Lead' && String(task.team?._id || task.team) !== String(req.user.team)) {
    throw new AppError('You can access only tasks in your team', 403);
  }
  if (req.user.role === 'Member') {
    if (!req.user.team || String(task.team?._id || task.team) !== String(req.user.team)) {
      throw new AppError('You can access only tasks in your team', 403);
    }
  }

  sendSuccess(res, { message: 'Task fetched successfully', data: { task } });
});

export const updateTask = catchAsync(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  if (!['Admin', 'Team Lead', 'Member'].includes(req.user.role)) throw new AppError('Only authorized users can update task details', 403);
  if (req.user.role === 'Team Lead' && String(task.team) !== String(req.user.team)) {
    throw new AppError('You can update tasks only for your assigned team', 403);
  }
  if (req.user.role === 'Member') {
    if (String(task.assignedTo) !== String(req.user._id)) {
      throw new AppError('You can edit only your own assigned task', 403);
    }
    const forbiddenMemberFields = ['project', 'assignedTo', 'team', 'createdBy'];
    const touchedForbiddenField = forbiddenMemberFields.some((field) => typeof req.body[field] !== 'undefined');
    if (touchedForbiddenField) {
      throw new AppError('Members cannot change project or assignment details', 403);
    }
  }

  const nextProject = req.body.project || task.project;
  const nextAssignedTo = req.body.assignedTo || task.assignedTo;
  const project = await assertProjectAssignment({ projectId: nextProject, assignedTo: nextAssignedTo, user: req.user });

  Object.assign(task, req.body);
  task.team = project.team;
  await task.save();
  await syncProjectCompletionStatus(task.project);
  await task.populate(taskPopulate);

  sendSuccess(res, { message: 'Task updated successfully', data: { task } });
});

export const deleteTask = catchAsync(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);
  if (req.user.role === 'Team Lead' && String(task.team) !== String(req.user.team)) {
    throw new AppError('You can delete tasks only for your assigned team', 403);
  }
  const projectId = task.project;
  await task.deleteOne();
  await syncProjectCompletionStatus(projectId);

  sendSuccess(res, { message: 'Task deleted successfully', data: {} });
});

export const updateTaskStatus = catchAsync(async (req, res) => {
  const task = await Task.findById(req.params.id);
  if (!task) throw new AppError('Task not found', 404);

  if (req.user.role === 'Team Lead' && String(task.team) !== String(req.user.team)) {
    throw new AppError('You can update status only for tasks in your team', 403);
  }
  if (req.user.role !== 'Admin' && String(task.assignedTo) !== String(req.user._id)) {
    if (req.user.role !== 'Team Lead') throw new AppError('You can update only your own assigned task status', 403);
  }

  task.status = req.body.status;
  await task.save();
  await syncProjectCompletionStatus(task.project);
  await task.populate(taskPopulate);

  sendSuccess(res, { message: 'Task status updated successfully', data: { task } });
});
