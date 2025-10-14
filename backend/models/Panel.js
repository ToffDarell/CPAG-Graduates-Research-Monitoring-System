import mongoose from "mongoose";

const panelSchema = new mongoose.Schema(
  {
    research: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Research",
      required: true,
    },
    members: [
      {
        faculty: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["chair", "member", "external_examiner"],
          required: true,
        },
        status: {
          type: String,
          enum: ["assigned", "confirmed", "declined"],
          default: "assigned",
        },
      },
    ],
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed"],
      default: "pending",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Panel", panelSchema);

