import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
    },
    module: {
      type: String,
      enum: [
        "documents",
        "research",
        "users",
        "archives",
        "panels",
        "feedback",
        "schedules",
        "settings",
        "activity",
        "admin",
      ],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Note: name already has unique: true which creates an index automatically
// No need to create duplicate index on name
permissionSchema.index({ module: 1 });

export default mongoose.model("Permission", permissionSchema);

