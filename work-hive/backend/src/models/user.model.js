import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 60
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 8,
      select: false
    },
    role: {
      type: String,
      enum: ['Admin', 'Team Lead', 'Member'],
      default: 'Member'
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null
    },
    profileStatus: {
      type: String,
      enum: ['Active', 'Away', 'Idle', 'Do Not Disturb'],
      default: 'Active'
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

userSchema.virtual('memberProjects', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'members'
});

userSchema.virtual('createdProjects', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'createdBy'
});

userSchema.virtual('managedTeam', {
  ref: 'Team',
  localField: '_id',
  foreignField: 'lead',
  justOne: true
});

userSchema.virtual('assignedTasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'assignedTo'
});

userSchema.virtual('createdTasks', {
  ref: 'Task',
  localField: '_id',
  foreignField: 'createdBy'
});

const sanitizeUser = (_, ret) => {
  delete ret.password;
  delete ret.__v;
  return ret;
};

userSchema.set('toJSON', { virtuals: true, transform: sanitizeUser });
userSchema.set('toObject', { virtuals: true, transform: sanitizeUser });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model('User', userSchema);
