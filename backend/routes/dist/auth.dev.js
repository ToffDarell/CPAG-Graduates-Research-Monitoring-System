"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _User = _interopRequireDefault(require("../models/User.js"));

var _jsonwebtoken = _interopRequireDefault(require("jsonwebtoken"));

var _auth = require("../middleware/auth.js");

var _googleAuthLibrary = require("google-auth-library");

var _dotenv = _interopRequireDefault(require("dotenv"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

_dotenv["default"].config();

var CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
var client = new _googleAuthLibrary.OAuth2Client(CLIENT_ID);

var router = _express["default"].Router(); // ========== reCAPTCHA verification ==========


function verifyRecaptchaToken(recaptchaToken, remoteIp) {
  var secretKey, params, response, data;
  return regeneratorRuntime.async(function verifyRecaptchaToken$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;

          if (recaptchaToken) {
            _context.next = 3;
            break;
          }

          return _context.abrupt("return", false);

        case 3:
          secretKey = process.env.RECAPTCHA_SECRET_KEY;

          if (secretKey) {
            _context.next = 6;
            break;
          }

          return _context.abrupt("return", false);

        case 6:
          params = new URLSearchParams();
          params.append('secret', secretKey);
          params.append('response', recaptchaToken);
          if (remoteIp) params.append('remoteip', remoteIp);
          _context.next = 12;
          return regeneratorRuntime.awrap(fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
          }));

        case 12:
          response = _context.sent;
          _context.next = 15;
          return regeneratorRuntime.awrap(response.json());

        case 15:
          data = _context.sent;
          return _context.abrupt("return", !!(data && data.success === true));

        case 19:
          _context.prev = 19;
          _context.t0 = _context["catch"](0);
          console.error('reCAPTCHA verification error:', _context.t0);
          return _context.abrupt("return", false);

        case 23:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 19]]);
} // ========== Verify Invitation Token ==========


router.get('/verify-invitation/:token', function _callee(req, res) {
  var user;
  return regeneratorRuntime.async(function _callee$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 3;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            invitationToken: req.params.token,
            invitationExpires: {
              $gt: Date.now()
            }
          }).select('-password'));

        case 3:
          user = _context2.sent;

          if (user) {
            _context2.next = 6;
            break;
          }

          return _context2.abrupt("return", res.status(400).json({
            message: 'Invalid or expired invitation token'
          }));

        case 6:
          res.json({
            valid: true,
            user: {
              name: user.name,
              email: user.email,
              role: user.role
            }
          });
          _context2.next = 12;
          break;

        case 9:
          _context2.prev = 9;
          _context2.t0 = _context2["catch"](0);
          res.status(500).json({
            message: 'Error verifying invitation token'
          });

        case 12:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 9]]);
}); // ========== Complete Registration (with invitation token) ==========

router.post('/complete-registration', function _callee2(req, res) {
  var _req$body, token, password, recaptcha, isHuman, user, jwtToken;

  return regeneratorRuntime.async(function _callee2$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _req$body = req.body, token = _req$body.token, password = _req$body.password, recaptcha = _req$body.recaptcha;
          _context3.prev = 1;
          _context3.next = 4;
          return regeneratorRuntime.awrap(verifyRecaptchaToken(recaptcha, req.ip));

        case 4:
          isHuman = _context3.sent;

          if (isHuman) {
            _context3.next = 7;
            break;
          }

          return _context3.abrupt("return", res.status(400).json({
            message: 'Recaptcha verification failed'
          }));

        case 7:
          _context3.next = 9;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            invitationToken: token,
            invitationExpires: {
              $gt: Date.now()
            }
          }));

        case 9:
          user = _context3.sent;

          if (user) {
            _context3.next = 12;
            break;
          }

          return _context3.abrupt("return", res.status(400).json({
            message: 'Invalid or expired invitation token'
          }));

        case 12:
          // Set password and activate account
          user.password = password;
          user.isActive = true;
          user.invitationToken = undefined;
          user.invitationExpires = undefined;
          _context3.next = 18;
          return regeneratorRuntime.awrap(user.save());

        case 18:
          // Generate JWT token
          jwtToken = _jsonwebtoken["default"].sign({
            id: user._id
          }, process.env.JWT_SECRET, {
            expiresIn: '30d'
          });
          res.json({
            message: 'Registration completed successfully',
            token: jwtToken,
            user: {
              id: user._id,
              name: user.name,
              email: user.email,
              role: user.role
            }
          });
          _context3.next = 26;
          break;

        case 22:
          _context3.prev = 22;
          _context3.t0 = _context3["catch"](1);
          console.error('Registration completion error:', _context3.t0);
          res.status(500).json({
            message: _context3.t0.message || 'Error completing registration'
          });

        case 26:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[1, 22]]);
}); // ========== Register ==========

router.post('/register', function _callee3(req, res) {
  var _req$body2, username, email, password, role, studentId, isHuman, existingUser, emailDomain, isStudent, userData, user, token;

  return regeneratorRuntime.async(function _callee3$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _req$body2 = req.body, username = _req$body2.username, email = _req$body2.email, password = _req$body2.password, role = _req$body2.role, studentId = _req$body2.studentId; // reCAPTCHA check

          _context4.next = 3;
          return regeneratorRuntime.awrap(verifyRecaptchaToken(req.body.recaptcha, req.ip));

        case 3:
          isHuman = _context4.sent;

          if (isHuman) {
            _context4.next = 6;
            break;
          }

          return _context4.abrupt("return", res.status(400).json({
            message: 'Recaptcha verification failed'
          }));

        case 6:
          _context4.prev = 6;

          if (!(!username || !email || !password || !role)) {
            _context4.next = 9;
            break;
          }

          return _context4.abrupt("return", res.status(400).json({
            message: 'All fields (username, email, password, role) are required'
          }));

        case 9:
          if (!(!email.endsWith('@buksu.edu.ph') && !email.endsWith('@student.buksu.edu.ph'))) {
            _context4.next = 11;
            break;
          }

          return _context4.abrupt("return", res.status(400).json({
            message: 'Institutional emails only'
          }));

        case 11:
          _context4.next = 13;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            email: email
          }));

        case 13:
          existingUser = _context4.sent;

          if (!existingUser) {
            _context4.next = 16;
            break;
          }

          return _context4.abrupt("return", res.status(400).json({
            message: 'Email already registered'
          }));

        case 16:
          // Validate email domain based on role
          emailDomain = email.split('@')[1];
          isStudent = role === 'graduate student';

          if (!(isStudent && emailDomain !== 'student.buksu.edu.ph')) {
            _context4.next = 20;
            break;
          }

          return _context4.abrupt("return", res.status(400).json({
            message: 'Graduate students must use @student.buksu.edu.ph email'
          }));

        case 20:
          if (!(!isStudent && emailDomain !== 'buksu.edu.ph')) {
            _context4.next = 22;
            break;
          }

          return _context4.abrupt("return", res.status(400).json({
            message: 'Faculty/Admin must use @buksu.edu.ph email'
          }));

        case 22:
          // Create user object based on role
          userData = _objectSpread({
            email: email,
            password: password,
            role: role
          }, role === "graduate student" ? {
            name: studentId,
            studentId: studentId
          } : {
            name: username
          });
          _context4.next = 25;
          return regeneratorRuntime.awrap(_User["default"].create(userData));

        case 25:
          user = _context4.sent;
          token = generateToken(user.id);
          res.status(201).json({
            id: user.id,
            username: role === "graduate student" ? user.studentId : user.name,
            email: user.email,
            role: user.role,
            token: token
          });
          _context4.next = 34;
          break;

        case 30:
          _context4.prev = 30;
          _context4.t0 = _context4["catch"](6);
          console.error(_context4.t0);
          res.status(500).json({
            message: 'Registration failed'
          });

        case 34:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[6, 30]]);
}); // ========== Login ==========

router.post('/login', function _callee4(req, res) {
  var _req$body3, email, password, role, isHuman, user, token;

  return regeneratorRuntime.async(function _callee4$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _req$body3 = req.body, email = _req$body3.email, password = _req$body3.password, role = _req$body3.role; // reCAPTCHA check

          _context5.next = 3;
          return regeneratorRuntime.awrap(verifyRecaptchaToken(req.body.recaptcha, req.ip));

        case 3:
          isHuman = _context5.sent;

          if (isHuman) {
            _context5.next = 6;
            break;
          }

          return _context5.abrupt("return", res.status(400).json({
            message: 'Recaptcha verification failed'
          }));

        case 6:
          _context5.prev = 6;

          if (!(!email || !password)) {
            _context5.next = 9;
            break;
          }

          return _context5.abrupt("return", res.status(400).json({
            message: 'All fields are required'
          }));

        case 9:
          if (!(!email.endsWith('@buksu.edu.ph') && !email.endsWith('@student.buksu.edu.ph'))) {
            _context5.next = 11;
            break;
          }

          return _context5.abrupt("return", res.status(400).json({
            message: 'Institutional emails only'
          }));

        case 11:
          _context5.next = 13;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            email: email
          }));

        case 13:
          user = _context5.sent;
          _context5.t0 = !user;

          if (_context5.t0) {
            _context5.next = 19;
            break;
          }

          _context5.next = 18;
          return regeneratorRuntime.awrap(user.matchPassword(password));

        case 18:
          _context5.t0 = !_context5.sent;

        case 19:
          if (!_context5.t0) {
            _context5.next = 21;
            break;
          }

          return _context5.abrupt("return", res.status(401).json({
            message: 'Invalid credentials'
          }));

        case 21:
          if (!(user.role !== role)) {
            _context5.next = 23;
            break;
          }

          return _context5.abrupt("return", res.status(403).json({
            message: "This email is registered as ".concat(user.role, ". Please select the correct role.")
          }));

        case 23:
          token = generateToken(user.id);
          res.status(200).json({
            id: user.id,
            username: user.name,
            email: user.email,
            role: user.role,
            token: token
          });
          _context5.next = 31;
          break;

        case 27:
          _context5.prev = 27;
          _context5.t1 = _context5["catch"](6);
          console.error(_context5.t1);
          res.status(500).json({
            message: 'Login failed'
          });

        case 31:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[6, 27]]);
}); // ========== Me ==========

router.get('/me', _auth.protect, function _callee5(req, res) {
  return regeneratorRuntime.async(function _callee5$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          res.status(200).json({
            id: req.user.id,
            username: req.user.name,
            email: req.user.email,
            role: req.user.role
          });

        case 1:
        case "end":
          return _context6.stop();
      }
    }
  });
}); // ========== Google OAuth ==========

router.post('/google', function _callee6(req, res) {
  var _req$body4, credential, selectedRole, ticket, payload, email, name, isStudentEmail, isFacultyEmail, role, user, token;

  return regeneratorRuntime.async(function _callee6$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.prev = 0;
          _req$body4 = req.body, credential = _req$body4.credential, selectedRole = _req$body4.selectedRole; // Add selectedRole from frontend

          if (credential) {
            _context7.next = 4;
            break;
          }

          return _context7.abrupt("return", res.status(400).json({
            message: 'Missing Google credential'
          }));

        case 4:
          _context7.next = 6;
          return regeneratorRuntime.awrap(client.verifyIdToken({
            idToken: credential,
            audience: CLIENT_ID
          }));

        case 6:
          ticket = _context7.sent;
          payload = ticket.getPayload();
          email = payload.email;
          name = payload.name || email.split('@')[0]; // Email domain validation

          isStudentEmail = email.endsWith('@student.buksu.edu.ph');
          isFacultyEmail = email.endsWith('@buksu.edu.ph');

          if (!(!isStudentEmail && !isFacultyEmail)) {
            _context7.next = 14;
            break;
          }

          return _context7.abrupt("return", res.status(400).json({
            message: 'Institutional emails only'
          }));

        case 14:
          if (!(isStudentEmail && !selectedRole.includes('student'))) {
            _context7.next = 16;
            break;
          }

          return _context7.abrupt("return", res.status(400).json({
            message: 'Student emails can only be used for graduate student accounts'
          }));

        case 16:
          if (!(isFacultyEmail && selectedRole.includes('student'))) {
            _context7.next = 18;
            break;
          }

          return _context7.abrupt("return", res.status(400).json({
            message: 'Faculty/Admin emails cannot be used for student accounts'
          }));

        case 18:
          // Set role based on email domain and selection
          role = isStudentEmail ? 'graduate student' : selectedRole; // Rest of the authentication process

          _context7.next = 21;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            email: email
          }));

        case 21:
          user = _context7.sent;

          if (user) {
            _context7.next = 26;
            break;
          }

          _context7.next = 25;
          return regeneratorRuntime.awrap(_User["default"].create({
            name: name,
            email: email,
            password: "google-oauth-".concat(Date.now()),
            role: role
          }));

        case 25:
          user = _context7.sent;

        case 26:
          token = generateToken(user.id);
          return _context7.abrupt("return", res.status(200).json({
            id: user.id,
            username: user.name,
            email: user.email,
            role: user.role,
            token: token
          }));

        case 30:
          _context7.prev = 30;
          _context7.t0 = _context7["catch"](0);
          console.error('Google auth error:', _context7.t0);
          return _context7.abrupt("return", res.status(401).json({
            message: 'Google authentication failed',
            error: _context7.t0.message
          }));

        case 34:
        case "end":
          return _context7.stop();
      }
    }
  }, null, null, [[0, 30]]);
}); // ========== JWT Token Generator ==========

var generateToken = function generateToken(id) {
  return _jsonwebtoken["default"].sign({
    id: id
  }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

var _default = router;
exports["default"] = _default;