import mongoose from "mongoose";

const scheduleSchema = new mongoose.Schema(
  {
    research: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Research",
      required: false, // Optional - consultation slots may not be tied to specific research
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
    consultationType: {
      type: String,
      enum: ["face-to-face", "online"],
      default: "face-to-face",
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
          enum: ["student", "adviser", "panel_member", "chair", "secretary"],
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
      enum: ["scheduled", "confirmed", "finalized", "completed", "cancelled"],
      default: "scheduled",
    },
    // Panel reference (for defense schedules)
    panel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Panel",
      required: false,
    },
    // Finalization tracking
    finalizedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    finalizedAt: {
      type: Date,
    },
    // Google Calendar integration
    googleCalendarEventId: {
      type: String,
    },
    googleCalendarLink: {
      type: String,
    },
    googleMeetLink: {
      type: String,
    },
    calendarSynced: {
      type: Boolean,
      default: false,
    },
    // Rejection reason (when consultation is declined)
    rejectionReason: {
      type: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", scheduleSchema);