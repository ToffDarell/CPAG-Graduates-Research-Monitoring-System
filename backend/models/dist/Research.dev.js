"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var researchSchema = new _mongoose["default"].Schema({
  title: {
    type: String,
    required: true
  },
  "abstract": {
    type: String
  },
  students: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User"
  }],
  adviser: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User"
  },
  panel: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User"
  }],
  // Status & Stage
  status: {
    type: String,
    "enum": ["pending", "approved", "rejected", "in-progress", "completed"],
    "default": "pending"
  },
  stage: {
    type: String,
    "default": "Proposal"
  },
  // Schedule for consultations/defenses
  schedule: {
    type: Date
  },
  // Timeline / Progress tracking
  timeline: [{
    stage: String,
    // e.g., Proposal, Defense, Final Submission
    status: {
      type: String,
      "enum": ["not-started", "in-progress", "completed"],
      "default": "not-started"
    },
    updatedAt: {
      type: Date,
      "default": Date.now
    }
  }],
  // Uploaded forms/documents (by Program Head or students)
  forms: [{
    filename: String,
    filepath: String,
    uploadedBy: {
      type: _mongoose["default"].Schema.Types.ObjectId,
      ref: "User"
    },
    uploadedAt: {
      type: Date,
      "default": Date.now
    }
  }],
  // Research records (to share with Dean)
  records: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Record" // optional separate model if records have more details

  }],
  createdAt: {
    type: Date,
    "default": Date.now
  },
  updatedAt: {
    type: Date,
    "default": Date.now
  }
}, {
  timestamps: true
});

var _default = _mongoose["default"].model("Research", researchSchema);

exports["default"] = _default;