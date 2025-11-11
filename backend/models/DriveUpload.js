import mongoose from "mongoose";

const driveUploadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number }, // in bytes (optional from Picker)
    driveFileId: { type: String, required: true },
    webViewLink: { type: String, required: true },
    iconLink: { type: String },
    thumbnailLink: { type: String },
    type: {
      type: String,
      enum: ["proposal", "progress_report", "chapter", "compliance", "other"],
      default: "other",
    },
    ownerEmail: { type: String },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sharedWithRoles: [
      {
        type: String,
        enum: ["dean", "program head", "faculty adviser", "graduate student"],
      },
    ],
    sharedWithUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    source: {
      type: String,
      enum: ["google", "local"],
      default: "google",
    },
    // Optional linkage to a Research record
    research: { type: mongoose.Schema.Types.ObjectId, ref: "Research" },
  },
  { timestamps: true }
);

driveUploadSchema.index({ owner: 1, createdAt: -1 });
driveUploadSchema.index({ research: 1, createdAt: -1 });

export default mongoose.model("DriveUpload", driveUploadSchema);


