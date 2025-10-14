"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.registerUser = void 0;

var _User = _interopRequireDefault(require("../models/User.js"));

var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// Generate JWT Token
var generateToken = function generateToken(id) {
  return _jsonwebtoken["default"].sign({
    id: id
  }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

var registerUser = function registerUser(req, res) {
  var _req$body, name, email, password, role, studentId, userExists, user;

  return regeneratorRuntime.async(function registerUser$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _req$body = req.body, name = _req$body.name, email = _req$body.email, password = _req$body.password, role = _req$body.role, studentId = _req$body.studentId; // Validate required fields

          if (!(!name || !email || !password || !role)) {
            _context.next = 4;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            message: "All fields (name, email, password, role) are required"
          }));

        case 4:
          if (!(role === "graduate student" && !studentId)) {
            _context.next = 6;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            message: "Student ID is required for graduate students"
          }));

        case 6:
          _context.next = 8;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            email: email
          }));

        case 8:
          userExists = _context.sent;

          if (!userExists) {
            _context.next = 11;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            message: "User already exists"
          }));

        case 11:
          _context.next = 13;
          return regeneratorRuntime.awrap(_User["default"].create({
            name: name,
            email: email,
            password: password,
            role: role,
            studentId: studentId,
            isActive: true // Since this is direct registration

          }));

        case 13:
          user = _context.sent;

          if (user) {
            res.status(201).json({
              _id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              studentId: user.studentId,
              token: generateToken(user._id)
            });
          }

          _context.next = 20;
          break;

        case 17:
          _context.prev = 17;
          _context.t0 = _context["catch"](0);
          res.status(400).json({
            message: _context.t0.message
          });

        case 20:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 17]]);
}; // ...existing code...


exports.registerUser = registerUser;