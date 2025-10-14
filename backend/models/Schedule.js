import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    research: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Research",
      required: true,
    },
    type: {
      type: String,
      enum: ["consultation", "proposal_defense", "final_defense"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    description: String,
    datetime: {
      type: Date,
      required: true,
    },
    duration: {
      type: Number, // in minutes
      default: 60,
    },
    location: {
      type: String,
      required: true,
    },
    participants: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["student", "adviser", "panel_member", "chair"],
          required: true,
        },
        status: {
          type: String,
          enum: ["invited", "confirmed", "declined"],
          default: "invited",
        },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "confirmed", "completed", "cancelled"],
      default: "scheduled",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", scheduleSchema);