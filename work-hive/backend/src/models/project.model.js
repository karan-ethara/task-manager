import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Project title is required'],
      trim: true,
      minlength: 2,
      maxlength: 120
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: ''
    },
    status: {
      type: String,
      enum: ['Planned', 'In Progress', 'Completed', 'On Hold'],
      default: 'Planned'
    },
    deadline: {
      type: Date,
      default: null
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ]
  },
  { timestamps: true }
);

projectSchema.virtual('tasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'project'
});

projectSchema.set('toJSON', { virtuals: true });
projectSchema.set('toObject', { virtuals: true });

projectSchema.index({ title: 1, createdBy: 1 });
projectSchema.index({ team: 1, status: 1, deadline: 1 });

export const Project = mongoose.model('Project', projectSchema);
