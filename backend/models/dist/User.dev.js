"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireDefault(require("mongoose"));

var _bcryptjs = _interopRequireDefault(require("bcryptjs"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var userSchema = new _mongoose["default"].Schema({
  name: {
    type: String,
    required: [true, "Full name is required"] // Now required for all roles

  },
  email: {
    type: String,
    required: true,
    unique: true,
    // Institutional email only (faculty OR student)
    match: [/@(buksu\.edu\.ph|student\.buksu\.edu\.ph)$/, "Invalid institutional email address"]
  },
  password: {
    type: String,
    required: function required() {
      return this.isActive; // Only required when account is active
    }
  },
  role: {
    type: String,
    "enum": ["admin/dean", "faculty adviser", "program head", "graduate student"],
    required: true
  },
  invitationToken: {
    type: String
  },
  invitationExpires: {
    type: Date
  },
  isActive: {
    type: Boolean,
    "default": false // false until they complete registration via invitation

  },
  studentId: {
    type: String,
    required: function required() {
      return this.role === "graduate student"; // Required only for students
    },
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
}); // ✅ Encrypt password before saving

userSchema.pre("save", function _callee(next) {
  var salt;
  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          if (this.isModified("password")) {
            _context.next = 2;
            break;
          }

          return _context.abrupt("return", next());

        case 2:
          _context.next = 4;
          return regeneratorRuntime.awrap(_bcryptjs["default"].genSalt(10));

        case 4:
          salt = _context.sent;
          _context.next = 7;
          return regeneratorRuntime.awrap(_bcryptjs["default"].hash(this.password, salt));

        case 7:
          this.password = _context.sent;
          next();

        case 9:
        case "end":
          return _context.stop();
      }
    }
  }, null, this);
}); // ✅ Compare entered password with hashed one

userSchema.methods.matchPassword = function _callee2(enteredPassword) {
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(_bcryptjs["default"].compare(enteredPassword, this.password));

        case 2:
          return _context2.abrupt("return", _context2.sent);

        case 3:
        case "end":
          return _context2.stop();
      }
    }
  }, null, this);
};

var User = _mongoose["default"].model("User", userSchema);

var _default = User;
exports["default"] = _default;