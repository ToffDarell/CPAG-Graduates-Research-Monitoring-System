import mongoose from "mongoose";

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    permissions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Permission",
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystem: {
      type: Boolean,
      default: false, // System roles cannot be deleted
    },
  },
  { timestamps: true }
);

roleSchema.index({ name: 1 });
roleSchema.index({ isActive: 1 });

export default mongoose.model("Role", roleSchema);
