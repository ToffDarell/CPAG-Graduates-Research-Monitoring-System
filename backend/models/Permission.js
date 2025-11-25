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

permissionSchema.index({ name: 1 });
permissionSchema.index({ module: 1 });

export default mongoose.model("Permission", permissionSchema);

