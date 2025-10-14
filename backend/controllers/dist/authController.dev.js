"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.login = exports.register = void 0;

var _User = _interopRequireDefault(require("../models/User.js"));

var _bcryptjs = _interopRequireDefault(require("bcryptjs"));

var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var register = function register(req, res) {
  var _req$body, name, email, password, role, userExists, salt, hashedPassword, user, token;

  return regeneratorRuntime.async(function register$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _req$body = req.body, name = _req$body.name, email = _req$body.email, password = _req$body.password, role = _req$body.role;
          console.log("Registration request:", req.body); // Debug log
          // Check if user exists

          _context.next = 5;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            email: email
          }));

        case 5:
          userExists = _context.sent;

          if (!userExists) {
            _context.next = 8;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            message: 'Email already registered'
          }));

        case 8:
          _context.next = 10;
          return regeneratorRuntime.awrap(_bcryptjs["default"].genSalt(10));

        case 10:
          salt = _context.sent;
          _context.next = 13;
          return regeneratorRuntime.awrap(_bcryptjs["default"].hash(password, salt));

        case 13:
          hashedPassword = _context.sent;
          _context.next = 16;
          return regeneratorRuntime.awrap(_User["default"].create({
            name: name,
            email: email,
            password: hashedPassword,
            role: role
          }));

        case 16:
          user = _context.sent;

          if (user) {
            token = _jsonwebtoken["default"].sign({
              id: user._id,
              role: user.role
            }, process.env.JWT_SECRET, {
              expiresIn: '30d'
            });
            res.status(201).json({
              _id: user._id,
              name: user.name,
              email: user.email,
              role: user.role,
              token: token
            });
          }

          _context.next = 24;
          break;

        case 20:
          _context.prev = 20;
          _context.t0 = _context["catch"](0);
          console.error("Registration error:", _context.t0); // Debug log

          res.status(500).json({
            message: _context.t0.message
          });

        case 24:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 20]]);
};

exports.register = register;

var login = function login(req, res) {
  var _req$body2, email, password, user, isPasswordValid, token;

  return regeneratorRuntime.async(function login$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _req$body2 = req.body, email = _req$body2.email, password = _req$body2.password;
          console.log("Login request:", req.body); // Debug log
          // Check if user exists

          _context2.next = 5;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            email: email
          }));

        case 5:
          user = _context2.sent;

          if (user) {
            _context2.next = 8;
            break;
          }

          return _context2.abrupt("return", res.status(400).json({
            message: 'Invalid credentials'
          }));

        case 8:
          _context2.next = 10;
          return regeneratorRuntime.awrap(_bcryptjs["default"].compare(password, user.password));

        case 10:
          isPasswordValid = _context2.sent;

          if (isPasswordValid) {
            _context2.next = 13;
            break;
          }

          return _context2.abrupt("return", res.status(400).json({
            message: 'Invalid credentials'
          }));

        case 13:
          token = _jsonwebtoken["default"].sign({
            id: user._id,
            role: user.role
          }, process.env.JWT_SECRET, {
            expiresIn: '30d'
          });
          res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            token: token
          });
          _context2.next = 21;
          break;

        case 17:
          _context2.prev = 17;
          _context2.t0 = _context2["catch"](0);
          console.error("Login error:", _context2.t0); // Debug log

          res.status(500).json({
            message: _context2.t0.message
          });

        case 21:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 17]]);
};

exports.login = login;