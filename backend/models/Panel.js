import mongoose from "mongoose";

const panelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: ["oral_defense", "thesis_review", "proposal_defense", "final_defense"],
      required: true,
    },
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
          required: function() {
            return !this.isExternal;
          },
        },
        // For external/invited panelists
        name: {
          type: String,
          required: function() {
            return this.isExternal;
          },
        },
        email: {
          type: String,
          required: function() {
            return this.isExternal;
          },
        },
        role: {
          type: String,
          enum: ["chair", "member", "external_examiner"],
          required: true,
        },
        status: {
          type: String,
          enum: ["assigned", "confirmed", "declined", "invited"],
          default: "assigned",
        },
        isSelected: {
          type: Boolean,
          default: false,
        },
        isExternal: {
          type: Boolean,
          default: false,
        },
        invitationToken: {
          type: String,
        },
        invitationExpires: {
          type: Date,
        },
        invitedAt: {
          type: Date,
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
      enum: ["pending", "confirmed", "in_progress", "completed", "archived", "scheduled"],
      default: "pending",
    },
    // Review progress tracking
    reviewDeadline: {
      type: Date,
    },
    meetingDate: {
      type: Date,
    },
    meetingLocation: {
      type: String,
    },
    // Panelist reviews/responses
    reviews: [
      {
        panelist: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: function() {
            return !this.isExternal;
          },
        },
        // For external panelists
        panelistEmail: {
          type: String,
          required: function() {
            return this.isExternal;
          },
        },
        panelistName: {
          type: String,
          required: function() {
            return this.isExternal;
          },
        },
        isExternal: {
          type: Boolean,
          default: false,
        },
        status: {
          type: String,
          enum: ["pending", "in_progress", "submitted", "overdue"],
          default: "pending",
        },
        comments: {
          type: String,
          default: "",
        },
        recommendation: {
          type: String,
          enum: ["approve", "reject", "revision", "pending"],
          default: "pending",
        },
        submittedAt: {
          type: Date,
        },
        dueDate: {
          type: Date,
        },
      },
    ],
    // Progress tracking
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    // Panel documents/resources
    documents: [
      {
        title: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          default: "",
        },
        filename: {
          type: String,
          required: true,
        },
        filepath: {
          type: String,
          required: true,
        },
        fileSize: {
          type: Number,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        version: {
          type: Number,
          default: 1,
        },
        isActive: {
          type: Boolean,
          default: true,
        },
        // Version history
        versions: [
          {
            version: {
              type: Number,
              required: true,
            },
            filename: {
              type: String,
              required: true,
            },
            filepath: {
              type: String,
              required: true,
            },
            fileSize: {
              type: Number,
              required: true,
            },
            uploadedBy: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            uploadedAt: {
              type: Date,
              default: Date.now,
            },
            changeDescription: {
              type: String,
              default: "",
            },
          },
        ],
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Panel", panelSchema);

