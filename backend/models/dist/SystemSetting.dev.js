"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var SystemSettingSchema = new _mongoose["default"].Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  value: {
    type: _mongoose["default"].Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

var _default = _mongoose["default"].model("SystemSetting", SystemSettingSchema);

exports["default"] = _default;