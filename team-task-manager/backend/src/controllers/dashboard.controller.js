import { Task } from '../models/task.model.js';
import { Project } from '../models/project.model.js';
import { Team } from '../models/team.model.js';
import { User } from '../models/user.model.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { catchAsync } from '../utils/catchAsync.js';

const getVisibleTaskFilter = (user) => {
  if (user.role === 'Admin') return {};
  if (user.role === 'Team Lead') return { team: user.team };
  return { assignedTo: user._id, team: user.team };
};

const now = () => new Date();
const weekAhead = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDayKey = (value) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getLastDays = (count) => {
  const days = [];
  const today = startOfDay(new Date());
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
};

export const getDashboard = catchAsync(async (req, res) => {
  const taskScopeFilter = req.user.role === 'Member' ? { team: req.user.team } : getVisibleTaskFilter(req.user);
  const teamScopeFilter = req.user.role === 'Admin' ? {} : { _id: req.user.team };
  const userScopeFilter = req.user.role === 'Admin' ? { isActive: true } : { team: req.user.team, isActive: true };
  const projectScopeFilter = req.user.role === 'Admin' ? {} : { team: req.user.team };

  const trendDays = getLastDays(7);
  const trendStart = trendDays[0];

  const [totalTasks, completedTasks, overdueTasks, activeUsers, totalProjects, dueSoonTasks, recentTasks, teams, tasksByTeam, completedByTeam, completedTrendAgg, memberAllocationAgg] = await Promise.all([
    Task.countDocuments(taskScopeFilter),
    Task.countDocuments({ ...taskScopeFilter, status: 'Completed' }),
    Task.countDocuments({ ...taskScopeFilter, status: { $ne: 'Completed' }, dueDate: { $lt: now() } }),
    User.countDocuments(userScopeFilter),
    Project.countDocuments(projectScopeFilter),
    Task.find({ ...taskScopeFilter, status: { $ne: 'Completed' }, dueDate: { $gte: now(), $lte: weekAhead() } })
      .populate('project', 'title')
      .sort({ dueDate: 1 })
      .limit(6),
    Task.find(taskScopeFilter)
      .populate('team', 'name')
      .populate('assignedTo', 'name')
      .sort({ updatedAt: -1 })
      .limit(8),
    Team.find(teamScopeFilter).populate('lead', 'name').sort({ name: 1 }),
    Task.aggregate([{ $match: { ...taskScopeFilter } }, { $group: { _id: '$team', count: { $sum: 1 } } }]),
    Task.aggregate([{ $match: { ...taskScopeFilter, status: 'Completed' } }, { $group: { _id: '$team', count: { $sum: 1 } } }]),
    Task.aggregate([
      { $match: { ...taskScopeFilter, status: 'Completed', updatedAt: { $gte: trendStart } } },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' },
            day: { $dayOfMonth: '$updatedAt' }
          },
          count: { $sum: 1 }
        }
      }
    ]),
    Task.aggregate([
      { $match: { ...taskScopeFilter } },
      { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ])
  ]);

  const userMap = new Map((await User.find({ _id: { $in: memberAllocationAgg.map((row) => row._id) } }).select('name')).map((u) => [String(u._id), u.name]));
  const teamTaskMap = new Map(tasksByTeam.map((entry) => [String(entry._id), entry.count]));
  const teamCompletedMap = new Map(completedByTeam.map((entry) => [String(entry._id), entry.count]));
  const trendMap = new Map(completedTrendAgg.map((row) => [`${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`, row.count]));

  const completionTrend = trendDays.map((day) => {
    const key = formatDayKey(day);
    return {
      date: key,
      label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: trendMap.get(key) || 0
    };
  });

  const teamProgress = teams.map((team) => {
    const total = teamTaskMap.get(String(team._id)) || 0;
    const completed = teamCompletedMap.get(String(team._id)) || 0;
    return {
      teamId: team._id,
      teamName: team.name,
      leadName: team.lead?.name || 'Unassigned',
      totalTasks: total,
      completedTasks: completed,
      progressPercent: total ? Math.round((completed / total) * 100) : 0
    };
  });

  const memberTaskAllocation = memberAllocationAgg.slice(0, 8).map((row) => ({
    userId: row._id,
    name: userMap.get(String(row._id)) || 'Unassigned',
    count: row.count
  }));

  const pendingTasks = Math.max(totalTasks - completedTasks, 0);
  const completionRate = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const recentActivity = recentTasks.map((task) => ({
    id: String(task._id),
    title: task.title,
    subtitle: `${task.team?.name || 'No team'} - ${task.assignedTo?.name || 'Unassigned'}`,
    createdAt: task.updatedAt
  }));

  return sendSuccess(res, {
    message: 'Dashboard fetched successfully',
    data: {
      role: req.user.role,
      stats: {
        totalTasks,
        completedTasks,
        pendingTasks,
        overdueTasks,
        completionRate,
        totalProjects,
        activeUsers
      },
      completionTrend,
      teamProgress,
      memberTaskAllocation,
      tasksDueThisWeek: dueSoonTasks,
      recentActivity
    }
  });
});

export const getOverdueTasks = catchAsync(async (req, res) => {
  const filter = { ...getVisibleTaskFilter(req.user), status: { $ne: 'Completed' }, dueDate: { $lt: now() } };
  const tasks = await Task.find(filter).populate('project', 'title').populate('assignedTo', 'name email role').sort({ dueDate: 1 });
  sendSuccess(res, { message: 'Overdue tasks fetched successfully', data: { tasks } });
});
