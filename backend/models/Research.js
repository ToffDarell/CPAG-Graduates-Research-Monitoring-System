import mongoose from "mongoose";

const researchSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    abstract: { type: String },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    adviser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    panel: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // Status & Stage
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "in-progress", "for-revision", "completed", "archived"],
      default: "pending",
    },
    stage: { 
      type: String, 
      enum: ["proposal", "chapter1", "chapter2", "chapter3", "defense", "final"],
      default: "proposal" 
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // Schedule for consultations/defenses
    schedule: {
      type: Date,
    },

    // Timeline / Progress tracking
    timeline: [
      {
        stage: String, // e.g., Proposal, Defense, Final Submission
        status: {
          type: String,
          enum: ["not-started", "in-progress", "completed"],
          default: "not-started",
        },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    // Uploaded forms/documents (by Program Head or students)
    forms: [
      {
        filename: String,
        filepath: String,
        type: {
          type: String,
          enum: ["proposal", "chapter1", "chapter2", "chapter3", "compliance", "other"],
          default: "other",
        },
        partName: { 
          type: String, 
          default: null // null means full chapter upload, string means specific part
        },
        version: { 
          type: Number, 
          default: 1 // Version number for this part (auto-incremented per part)
        },
        status: {
          type: String,
          enum: ["pending", "approved", "rejected", "revision"],
          default: "pending",
        },
        feedback: { 
          type: String, 
          default: null // Adviser feedback for this submission
        },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        uploadedAt: { type: Date, default: Date.now },
        driveFileId: { type: String },
        driveFileLink: { type: String },
        driveFileName: { type: String },
        driveMimeType: { type: String },
        driveFolderId: { type: String },
        storageLocation: {
          type: String,
          enum: ["local", "google-drive", "local+google-drive"],
          default: "local",
        },
      },
    ],

    // Research records (to share with Dean)
    records: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Record", // optional separate model if records have more details
      },
    ],

    archivedAt: Date,
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    statusBeforeArchive: {
      type: String,
      enum: ["pending", "approved", "rejected", "in-progress", "for-revision", "completed"],
    },
    
    // Sharing with Dean
    sharedWithDean: {
      type: Boolean,
      default: false,
    },
    sharedAt: Date,
    sharedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Research", researchSchema);
