"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var GradeSchema = new _mongoose["default"].Schema({
  research: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Research",
    required: true
  },
  student: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  instructor: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  grade: {
    type: Number,
    required: true
  },
  // 0–100
  remarks: String
}, {
  timestamps: true
});

var _default = _mongoose["default"].model("Grade", GradeSchema);

exports["default"] = _default;