"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var MinutesSchema = new _mongoose["default"].Schema({
  meetingData: {
    type: String,
    required: true
  },
  secretary: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "User"
  },
  research: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Research"
  },
  notes: {
    type: String
  },
  fileUrl: {
    type: String
  }
});

var _default = _mongoose["default"].model("Minutes", MinutesSchema);

exports["default"] = _default;