"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var ScheduleSchema = new _mongoose["default"].Schema({
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
  adviser: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  panel: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User"
  }],
  chairperson: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    "enum": ["consultation", "defense"],
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  location: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

var _default = _mongoose["default"].model("Schedule", ScheduleSchema);

exports["default"] = _default;