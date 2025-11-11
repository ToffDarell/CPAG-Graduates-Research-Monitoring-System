import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Full name is required"], // Now required for all roles
    },
    email: {
      type: String,
      required: true,
      unique: true,
      // Institutional email only (faculty OR student)
      match: [
        /@(buksu\.edu\.ph|student\.buksu\.edu\.ph)$/,
        "Invalid institutional email address",
      ],
    },
    password: {
      type: String,
      required: function() {
        return this.isActive; // Only required when account is active
      },
    },
    role: {
      type: String,
      enum: [
        "dean",
        "faculty adviser",
        "program head",
        "graduate student",
      ],
      required: true,
    },
    invitationToken: {
      type: String,
    },
    invitationExpires: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      
      default: function() {
        // Dean and students are automatically active
        return this.role === 'dean' || this.role === 'graduate student';
      },
    },
    studentId: {
      type: String,
      required: function() {
        return this.role === "graduate student"; // Required only for students
      },
      unique: true,
      sparse: true
    },
    // Google Calendar integration
    googleAccessToken: {
      type: String,
    },
    googleRefreshToken: {
      type: String,
    },
    googleTokenExpiry: {
      type: Date,
    },
    calendarConnected: {
      type: Boolean,
      default: false,
    },
    // Google Drive integration
    driveAccessToken: {
      type: String,
    },
    driveRefreshToken: {
      type: String,
    },
    driveTokenExpiry: {
      type: Date,
    },
    driveConnected: {
      type: Boolean,
      default: false,
    },
    // Password reset fields
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    }
  },
  { timestamps: true }
);

// ✅ Encrypt password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ Compare entered password with hashed one
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", userSchema);

export default User;
