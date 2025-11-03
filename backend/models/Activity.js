import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "upload", "delete", "archive", "restore", "download", "view",
        "create", "update", "approve", "reject", "invite", "activate", 
        "deactivate", "assign", "remove", "share", "send_email", "add_remark"
      ],
      required: true,
    },
    entityType: {
      type: String,
      enum: ["document", "research", "user", "panel", "feedback", "settings", "email", "schedule"],
      required: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // Some actions like send_email may not have an entityId
    },
    entityName: String, // For display purposes
    description: String,
    metadata: mongoose.Schema.Types.Mixed, // Additional data
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

// Index for faster queries
activitySchema.index({ user: 1, createdAt: -1 });
activitySchema.index({ action: 1, createdAt: -1 });
activitySchema.index({ entityType: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);