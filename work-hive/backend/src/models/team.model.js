import mongoose from 'mongoose';

const teamSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Team name is required'],
      trim: true,
      minlength: 2,
      maxlength: 120,
      unique: true
    },
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    }
  },
  { timestamps: true }
);

teamSchema.virtual('members', {
  ref: 'User',
  localField: '_id',
  foreignField: 'team'
});

teamSchema.virtual('projects', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'team'
});

teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

export const Team = mongoose.model('Team', teamSchema);

