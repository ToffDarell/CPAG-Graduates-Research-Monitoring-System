import mongoose from "mongoose";

const complianceFormSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    research: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Research",
      required: true,
    },
    formType: {
      type: String,
      enum: ["ethics", "declaration", "consent", "authorization", "other"],
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
    mimeType: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "revision"],
      default: "pending",
    },
    version: {
      type: Number,
      default: 1,
    },
    isCurrent: {
      type: Boolean,
      default: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: {
      type: Date,
    },
    reviewComments: {
      type: String,
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
    previousVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ComplianceForm",
    },
  },
  { timestamps: true }
);

// Index for faster queries
complianceFormSchema.index({ student: 1, formType: 1, isCurrent: 1 });
complianceFormSchema.index({ research: 1, status: 1 });
complianceFormSchema.index({ uploadedAt: -1 });

export default mongoose.model("ComplianceForm", complianceFormSchema);

