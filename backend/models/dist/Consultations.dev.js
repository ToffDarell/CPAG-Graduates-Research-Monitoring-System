"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var consultationSchema = new _mongoose["default"].Schema({
  student: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  adviser: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  note: {
    type: String,
    required: false
  },
  status: {
    type: String,
    "enum": ["scheduled", "completed", "cancelled"],
    "default": "scheduled"
  },
  feedback: {
    type: String
  }
}, {
  timestamps: true
});

var _default = _mongoose["default"].model("Consultation", consultationSchema);

exports["default"] = _default;