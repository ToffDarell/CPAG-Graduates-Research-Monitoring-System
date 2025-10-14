"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _auth = require("../middleware/auth.js");

var _Research = _interopRequireDefault(require("../models/Research.js"));

var _Schedule = _interopRequireDefault(require("../models/Schedule.js"));

var _User = _interopRequireDefault(require("../models/User.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router();
/**
 * Graduate Student Functional Requirements
 */
// Upload compliance forms


router.post("/upload-compliance", (0, _auth.checkAuth)(["student"]), function _callee(req, res) {
  var _req$body, researchId, complianceForm, research;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          if (!(req.user.level !== "graduate")) {
            _context.next = 2;
            break;
          }

          return _context.abrupt("return", res.status(403).json({
            message: "Only graduate students can upload compliance forms."
          }));

        case 2:
          _req$body = req.body, researchId = _req$body.researchId, complianceForm = _req$body.complianceForm;
          _context.next = 5;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            $push: {
              complianceForms: {
                file: complianceForm,
                uploadedBy: req.user._id
              }
            }
          }, {
            "new": true
          }));

        case 5:
          research = _context.sent;
          res.json({
            message: "Compliance form uploaded",
            research: research
          });

        case 7:
        case "end":
          return _context.stop();
      }
    }
  });
}); // Upload chapters (1–3 + approved title)

router.post("/upload-chapters", (0, _auth.checkAuth)(["student"]), function _callee2(req, res) {
  var _req$body2, researchId, title, chapters, research;

  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          if (!(req.user.level !== "graduate")) {
            _context2.next = 2;
            break;
          }

          return _context2.abrupt("return", res.status(403).json({
            message: "Only graduate students can upload chapters."
          }));

        case 2:
          _req$body2 = req.body, researchId = _req$body2.researchId, title = _req$body2.title, chapters = _req$body2.chapters; // chapters = [ch1, ch2, ch3]

          _context2.next = 5;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            approvedTitle: title,
            $push: {
              chapters: {
                uploadedBy: req.user._id,
                files: chapters
              }
            }
          }, {
            "new": true
          }));

        case 5:
          research = _context2.sent;
          res.json({
            message: "Graduate chapters uploaded",
            research: research
          });

        case 7:
        case "end":
          return _context2.stop();
      }
    }
  });
}); // View consultation/defense schedules

router.get("/schedules", (0, _auth.checkAuth)(["student"]), function _callee3(req, res) {
  var schedules;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          if (!(req.user.level !== "graduate")) {
            _context3.next = 2;
            break;
          }

          return _context3.abrupt("return", res.status(403).json({
            message: "Only graduate students can view schedules."
          }));

        case 2:
          _context3.next = 4;
          return regeneratorRuntime.awrap(_Schedule["default"].find({
            participants: req.user._id
          }).populate("research", "title").populate("participants", "name email"));

        case 4:
          schedules = _context3.sent;
          res.json(schedules);

        case 6:
        case "end":
          return _context3.stop();
      }
    }
  });
}); // Logout

router.post("/logout", (0, _auth.checkAuth)(["student"]), function _callee4(req, res) {
  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          // Invalidate token client-side or manage session
          res.json({
            message: "Graduate student logged out successfully"
          });

        case 1:
        case "end":
          return _context4.stop();
      }
    }
  });
}); // Login route

router.post("/login", function _callee5(req, res) {
  var _req$body3, email, password, user, isMatch;

  return regeneratorRuntime.async(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          _req$body3 = req.body, email = _req$body3.email, password = _req$body3.password;

          if (!(!email || !password)) {
            _context5.next = 4;
            break;
          }

          return _context5.abrupt("return", res.status(400).json({
            message: "Email and password are required"
          }));

        case 4:
          _context5.next = 6;
          return regeneratorRuntime.awrap(_User["default"].findOne({
            email: email
          }));

        case 6:
          user = _context5.sent;

          if (user) {
            _context5.next = 9;
            break;
          }

          return _context5.abrupt("return", res.status(401).json({
            message: "Invalid email or password"
          }));

        case 9:
          _context5.next = 11;
          return regeneratorRuntime.awrap(user.matchPassword(password));

        case 11:
          isMatch = _context5.sent;

          if (isMatch) {
            _context5.next = 14;
            break;
          }

          return _context5.abrupt("return", res.status(401).json({
            message: "Invalid email or password"
          }));

        case 14:
          // Return user data using name instead of username
          res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            studentId: user.studentId,
            token: generateToken(user._id)
          });
          _context5.next = 20;
          break;

        case 17:
          _context5.prev = 17;
          _context5.t0 = _context5["catch"](0);
          res.status(500).json({
            message: _context5.t0.message
          });

        case 20:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 17]]);
});
var _default = router;
exports["default"] = _default;