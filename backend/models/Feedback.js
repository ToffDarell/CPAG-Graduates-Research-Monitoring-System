import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema(
  {
    research: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Research",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    adviser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["approval", "rejection", "feedback", "revision", "general", "chapter_review", "progress_update"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    file: {
      filename: String,
      filepath: String,
      filesize: Number, // in bytes
      mimetype: String,
      uploadedAt: { type: Date, default: Date.now },
    },
    category: {
      type: String,
      enum: ["general", "chapter_review", "progress_update", "revision_request", "approval", "other"],
      default: "general"
    },
    status: {
      type: String,
      enum: ["pending", "read", "resolved"],
      default: "pending",
    },
    version: {
      type: Number,
      default: 1
    }
  },
  { timestamps: true }
);

// Index for faster queries
feedbackSchema.index({ student: 1, createdAt: -1 });
feedbackSchema.index({ adviser: 1, createdAt: -1 });
feedbackSchema.index({ research: 1, createdAt: -1 });

export default mongoose.model("Feedback", feedbackSchema);
