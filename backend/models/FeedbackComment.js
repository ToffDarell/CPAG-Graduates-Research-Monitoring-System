import mongoose from "mongoose";

const feedbackCommentSchema = new mongoose.Schema({
  feedback: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Feedback",
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  comment: {
    type: String,
    required: true
  },
  // Position information for PDFs and documents
  position: {
    pageNumber: Number,        // For PDFs
    startIndex: Number,        // Character position (optional)
    endIndex: Number,          // Character position (optional)
    coordinates: {
      x: Number,               // X coordinate
      y: Number,               // Y coordinate
      width: Number,           // Width of selection
      height: Number           // Height of selection
    },
    selectedText: String       // The selected text
  },
  // For highlighting
  highlightColor: {
    type: String,
    default: "#ffeb3b" // Yellow
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

// Indexes
feedbackCommentSchema.index({ feedback: 1, createdAt: -1 });
feedbackCommentSchema.index({ createdBy: 1 });

export default mongoose.model("FeedbackComment", feedbackCommentSchema);


