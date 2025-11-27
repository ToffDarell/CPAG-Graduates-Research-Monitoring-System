import mongoose from "mongoose";

const documentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: String,
    category: {
      type: String,
      enum: ["form", "template", "guideline", "policy", "other"],
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
    driveFileId: String,
    driveFileLink: String,
    driveFileName: String,
    driveMimeType: String,
    driveFolderId: String,
    storageLocation: {
      type: String,
      enum: ["local", "google-drive", "local+google-drive"],
      default: "local",
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    accessibleTo: [
      {
        type: String,
        enum: ["dean", "program head", "faculty adviser", "graduate student"],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Document", documentSchema);

