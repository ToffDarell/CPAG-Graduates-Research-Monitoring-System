"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.authorize = exports.checkAuth = exports.protect = void 0;

var _User = _interopRequireDefault(require("../models/User.js"));

var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));

var _googleAuthLibrary = require("google-auth-library");

var _dotenv = _interopRequireDefault(require("dotenv"));

var _executableResponse = require("google-auth-library/build/src/auth/executable-response.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

_dotenv["default"].config();

var CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
var client = new _googleAuthLibrary.OAuth2Client(CLIENT_ID);

var protect = function protect(req, res, next) {
  var token, decoded;
  return regeneratorRuntime.async(function protect$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          if (!(req.headers.authorization && req.headers.authorization.startsWith("Bearer"))) {
            _context.next = 14;
            break;
          }

          _context.prev = 1;
          token = req.headers.authorization.split(" ")[1];
          decoded = _jsonwebtoken["default"].verify(token, process.env.JWT_SECRET);
          _context.next = 6;
          return regeneratorRuntime.awrap(_User["default"].findById(decoded.id).select("-password"));

        case 6:
          req.user = _context.sent;
          return _context.abrupt("return", next());

        case 10:
          _context.prev = 10;
          _context.t0 = _context["catch"](1);
          console.error("Token verification failed: ", _context.t0.message);
          return _context.abrupt("return", res.status(401).json({
            message: "Not authorized, token failed"
          }));

        case 14:
          return _context.abrupt("return", res.status(401).json({
            message: "Not authorized, token failed"
          }));

        case 15:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 10]]);
};

exports.protect = protect;

var checkAuth = function checkAuth() {
  var roles = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  return function (req, res, next) {
    var user = req.user;
    if (!user) return res.status(401).json({
      message: "Unauthorized"
    }); //Instituional email check

    if (!user.email.endsWith("@buksu.edu.ph") && !user.email.endsWith("@student.buksu.edu.ph")) {
      return res.status(403).json({
        message: "Institutional email required"
      });
    } //Role Check


    if (roles.length && !roles.includes(user.role)) {
      return res.status(403).json({
        message: "AccessDenied"
      });
    }

    next();
  };
};

exports.checkAuth = checkAuth;

var authorize = function authorize() {
  var roles = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
  return checkAuth(roles); // Reuse existing checkAuth function
};

exports.authorize = authorize;