import { Team } from '../models/team.model.js';
import { User } from '../models/user.model.js';
import { Project } from '../models/project.model.js';
import { Task } from '../models/task.model.js';
import { AppError } from '../utils/AppError.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

const teamPopulate = [
  { path: 'lead', select: 'name email role team profileStatus isActive createdAt' },
  { path: 'members', select: 'name email role team profileStatus isActive createdAt', match: { isActive: true } }
];

const getTeamScopeFilter = (user) => (user.role === 'Admin' ? {} : { _id: user.team });

const assertTeamManageAccess = (user, teamId) => {
  if (user.role === 'Admin') return;
  if (user.role === 'Team Lead' && String(user.team) === String(teamId)) return;
  throw new AppError('You can manage members only in your assigned team', 403);
};

const ensureLeadEligibility = async (leadId, teamId = null) => {
  const lead = await User.findById(leadId);
  if (!lead || !lead.isActive) throw new AppError('Team lead not found', 404);
  if (lead.role === 'Admin') throw new AppError('Admin cannot be assigned as team lead', 400);

  const existingTeamWithLead = await Team.findOne({ lead: lead._id, ...(teamId ? { _id: { $ne: teamId } } : {}) });
  if (existingTeamWithLead) throw new AppError('This team lead already manages another team', 400);

  return lead;
};

const buildTeamStatsMap = async (teamIds) => {
  if (!teamIds.length) return new Map();

  const [projectCounts, taskStatusCounts, recentTaskActivity, recentProjectActivity, projectSummaries] = await Promise.all([
    Project.aggregate([{ $match: { team: { $in: teamIds } } }, { $group: { _id: '$team', count: { $sum: 1 } } }]),
    Task.aggregate([
      { $match: { team: { $in: teamIds } } },
      { $group: { _id: { team: '$team', status: '$status' }, count: { $sum: 1 } } }
    ]),
    Task.aggregate([{ $match: { team: { $in: teamIds } } }, { $group: { _id: '$team', recentAt: { $max: '$createdAt' } } }]),
    Project.aggregate([{ $match: { team: { $in: teamIds } } }, { $group: { _id: '$team', recentAt: { $max: '$createdAt' } } }]),
    Project.find({ team: { $in: teamIds } }).select('team deadline status')
  ]);

  const projectMap = new Map(projectCounts.map(({ _id, count }) => [String(_id), count]));
  const recentTaskMap = new Map(recentTaskActivity.map(({ _id, recentAt }) => [String(_id), recentAt]));
  const recentProjectMap = new Map(recentProjectActivity.map(({ _id, recentAt }) => [String(_id), recentAt]));
  const statusMap = new Map();
  taskStatusCounts.forEach(({ _id, count }) => {
    const key = String(_id.team);
    if (!statusMap.has(key)) statusMap.set(key, { total: 0, completed: 0, todo: 0, inProgress: 0 });
    const current = statusMap.get(key);
    current.total += count;
    if (_id.status === 'Completed') current.completed += count;
    if (_id.status === 'Todo') current.todo += count;
    if (_id.status === 'In Progress') current.inProgress += count;
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const atRiskBoundary = new Date(now);
  atRiskBoundary.setDate(atRiskBoundary.getDate() + 3);
  const projectRiskMap = new Map();
  projectSummaries.forEach((project) => {
    const key = String(project.team);
    if (!projectRiskMap.has(key)) projectRiskMap.set(key, { overdueProjects: 0, atRiskProjects: 0 });
    const bucket = projectRiskMap.get(key);
    if (project.status === 'Completed' || !project.deadline) return;
    const deadline = new Date(project.deadline);
    deadline.setHours(0, 0, 0, 0);
    if (deadline < now) bucket.overdueProjects += 1;
    else if (deadline <= atRiskBoundary) bucket.atRiskProjects += 1;
  });

  const combined = new Map();
  teamIds.forEach((id) => {
    const key = String(id);
    const status = statusMap.get(key) || { total: 0, completed: 0, todo: 0, inProgress: 0 };
    const risk = projectRiskMap.get(key) || { overdueProjects: 0, atRiskProjects: 0 };
    const total = status.total || 0;
    combined.set(key, {
      projectCount: projectMap.get(key) || 0,
      taskCount: total,
      openTaskCount: (status.todo || 0) + (status.inProgress || 0),
      completedTaskCount: status.completed,
      todoTaskCount: status.todo,
      inProgressTaskCount: status.inProgress,
      progress: total ? Math.round((status.completed / total) * 100) : 0,
      overdueProjects: risk.overdueProjects,
      atRiskProjects: risk.atRiskProjects,
      recentActivityAt: [recentTaskMap.get(key), recentProjectMap.get(key)].filter(Boolean).sort((a, b) => new Date(b) - new Date(a))[0] || null
    });
  });

  return combined;
};

const serializeTeam = (team, statsMap) => {
  const stats = statsMap.get(String(team._id)) || {
    projectCount: 0, taskCount: 0, completedTaskCount: 0, todoTaskCount: 0, inProgressTaskCount: 0, progress: 0
  };
  const members = (team.members || []).filter((m) => m.role === 'Member');
  return {
    ...team.toObject(),
    memberCount: members.length,
    ...stats
  };
};

export const getTeams = catchAsync(async (req, res) => {
  const teams = await Team.find(getTeamScopeFilter(req.user)).populate(teamPopulate).sort({ name: 1 });
  const statsMap = await buildTeamStatsMap(teams.map((team) => team._id));
  const hydratedTeams = teams.map((team) => serializeTeam(team, statsMap));
  sendSuccess(res, { message: 'Teams fetched successfully', data: { teams: hydratedTeams } });
});

export const getMyTeam = catchAsync(async (req, res) => {
  if (!req.user.team) throw new AppError('No team assigned', 404);
  const team = await Team.findById(req.user.team).populate(teamPopulate);
  if (!team) throw new AppError('Team not found', 404);
  const statsMap = await buildTeamStatsMap([team._id]);
  sendSuccess(res, { message: 'Team fetched successfully', data: { team: serializeTeam(team, statsMap) } });
});

export const getTeam = catchAsync(async (req, res) => {
  const team = await Team.findById(req.params.id).populate(teamPopulate);
  if (!team) throw new AppError('Team not found', 404);
  if (req.user.role !== 'Admin' && String(req.user.team) !== String(team._id)) {
    throw new AppError('You do not have permission to access this team', 403);
  }

  const [projects, tasks, statsMap] = await Promise.all([
    Project.find({ team: team._id })
      .populate('createdBy', 'name email role')
      .populate('members', 'name email role profileStatus')
      .sort({ createdAt: -1 }),
    Task.find(
      req.user.role === 'Member' ? { team: team._id, assignedTo: req.user._id } : { team: team._id }
    )
      .populate('project', 'title')
      .populate('assignedTo', 'name email role profileStatus')
      .populate('createdBy', 'name email role')
      .sort({ createdAt: -1 }),
    buildTeamStatsMap([team._id])
  ]);

  sendSuccess(res, {
    message: 'Team details fetched successfully',
    data: {
      team: serializeTeam(team, statsMap),
      projects,
      tasks
    }
  });
});

export const createTeam = catchAsync(async (req, res) => {
  const lead = await ensureLeadEligibility(req.body.leadId);
  const team = await Team.create({ name: req.body.name, lead: lead._id });
  lead.role = 'Team Lead';
  lead.team = team._id;
  await lead.save();

  await team.populate(teamPopulate);
  const statsMap = await buildTeamStatsMap([team._id]);
  sendSuccess(res, { statusCode: 201, message: 'Team created successfully', data: { team: serializeTeam(team, statsMap) } });
});

export const updateTeam = catchAsync(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found', 404);

  if (req.body.name) team.name = req.body.name;
  if (req.body.leadId) {
    const nextLead = await ensureLeadEligibility(req.body.leadId, team._id);
    const previousLeadId = team.lead ? String(team.lead) : null;
    team.lead = nextLead._id;
    nextLead.role = 'Team Lead';
    nextLead.team = team._id;
    await nextLead.save();

    if (previousLeadId && previousLeadId !== String(nextLead._id)) {
      const previousLead = await User.findById(previousLeadId);
      if (previousLead && previousLead.role === 'Team Lead') {
        previousLead.role = 'Member';
        await previousLead.save();
      }
    }
  }

  await team.save();
  await team.populate(teamPopulate);
  const statsMap = await buildTeamStatsMap([team._id]);
  sendSuccess(res, { message: 'Team updated successfully', data: { team: serializeTeam(team, statsMap) } });
});

export const addMember = catchAsync(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found', 404);
  assertTeamManageAccess(req.user, team._id);

  const user = await User.findById(req.body.userId);
  if (!user || !user.isActive) throw new AppError('User not found', 404);
  if (user.role === 'Admin') throw new AppError('Admin cannot be added to team as member', 400);
  if (user.role !== 'Member') throw new AppError('Only users with Member role can be added as team members', 400);
  if (String(user._id) === String(team.lead)) throw new AppError('Team lead is already part of this team', 400);
  if (user.team && String(user.team) !== String(team._id)) {
    throw new AppError('User is already assigned to another team', 400);
  }

  user.team = team._id;
  await user.save();

  const populated = await Team.findById(team._id).populate(teamPopulate);
  const statsMap = await buildTeamStatsMap([team._id]);
  sendSuccess(res, { message: 'Member added successfully', data: { team: serializeTeam(populated, statsMap) } });
});

export const removeMember = catchAsync(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found', 404);
  assertTeamManageAccess(req.user, team._id);
  if (String(team.lead) === String(req.params.userId)) {
    throw new AppError('Cannot remove team lead. Assign a new lead first.', 400);
  }

  const user = await User.findById(req.params.userId);
  if (!user || String(user.team) !== String(team._id)) throw new AppError('Member not found in this team', 404);

  const activeTaskExists = await Task.exists({
    team: team._id,
    assignedTo: user._id,
    status: { $in: ['Todo', 'In Progress'] }
  });
  if (activeTaskExists) {
    throw new AppError('Cannot remove member with active tasks. Reassign or complete those tasks first.', 400);
  }

  user.team = null;
  user.role = 'Member';
  await user.save();

  const populated = await Team.findById(team._id).populate(teamPopulate);
  const statsMap = await buildTeamStatsMap([team._id]);
  sendSuccess(res, { message: 'Member removed successfully', data: { team: serializeTeam(populated, statsMap) } });
});

export const deleteTeam = catchAsync(async (req, res) => {
  const team = await Team.findById(req.params.id);
  if (!team) throw new AppError('Team not found', 404);

  await Promise.all([
    Task.deleteMany({ team: team._id }),
    Project.deleteMany({ team: team._id }),
    User.updateMany({ team: team._id }, { $set: { team: null, role: 'Member' } }),
    team.deleteOne()
  ]);

  sendSuccess(res, { message: 'Team deleted successfully with related projects and tasks', data: {} });
});
