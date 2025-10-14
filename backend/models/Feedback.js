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
      enum: ["approval", "rejection", "feedback", "revision"],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    file: {
      filename: String,
      filepath: String,
      uploadedAt: { type: Date, default: Date.now },
    },
    status: {
      type: String,
      enum: ["pending", "read", "resolved"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Feedback", feedbackSchema);
