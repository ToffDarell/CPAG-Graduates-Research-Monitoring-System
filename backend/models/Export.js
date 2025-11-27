import mongoose from "mongoose";

const exportSchema = new mongoose.Schema(
  {
    exportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    format: {
      type: String,
      enum: ["pdf", "xlsx"],
      required: true,
    },
    recordCount: {
      type: Number,
      required: true,
    },
    selectedFields: [{
      type: String,
    }],
    filters: {
      status: String,
      stage: String,
      adviserId: String,
      startDate: Date,
      endDate: Date,
      academicYear: String,
    },
    driveFileId: {
      type: String,
    },
    driveFileLink: {
      type: String,
    },
    driveFileName: {
      type: String,
    },
    driveFolderId: {
      type: String,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number, // in bytes
    },
    mimeType: {
      type: String,
    },
    status: {
      type: String,
      enum: ["completed", "failed"],
      default: "completed",
    },
    errorMessage: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for faster queries
exportSchema.index({ exportedBy: 1, createdAt: -1 });
exportSchema.index({ format: 1, createdAt: -1 });

const Export = mongoose.model("Export", exportSchema);

export default Export;


