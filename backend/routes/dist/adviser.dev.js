"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _auth = require("../middleware/auth.js");

var _Research = _interopRequireDefault(require("../models/Research.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router(); // -------------------- PROTECTION --------------------


router.use(_auth.protect, (0, _auth.checkAuth)(["adviser"])); // ✅ Every route below requires adviser role
// -------------------- FEEDBACK --------------------
// Adviser submits feedback on a research

router.post("/feedback", function _callee(req, res) {
  var _req$body, researchId, feedback, research;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _req$body = req.body, researchId = _req$body.researchId, feedback = _req$body.feedback;
          _context.prev = 1;
          _context.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            $push: {
              feedback: {
                user: req.user._id,
                text: feedback,
                role: "adviser",
                createdAt: new Date()
              }
            }
          }, {
            "new": true
          }).populate("student adviser panel"));

        case 4:
          research = _context.sent;
          res.json({
            message: "Feedback submitted by adviser",
            research: research
          });
          _context.next = 11;
          break;

        case 8:
          _context.prev = 8;
          _context.t0 = _context["catch"](1);
          res.status(400).json({
            message: _context.t0.message
          });

        case 11:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 8]]);
}); // -------------------- REVIEW RESEARCH --------------------
// Adviser approves or rejects research submission

router.post("/review", function _callee2(req, res) {
  var _req$body2, researchId, status, research;

  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _req$body2 = req.body, researchId = _req$body2.researchId, status = _req$body2.status;
          _context2.prev = 1;

          if (["approved", "rejected"].includes(status)) {
            _context2.next = 4;
            break;
          }

          return _context2.abrupt("return", res.status(400).json({
            message: "Invalid status"
          }));

        case 4:
          _context2.next = 6;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            status: status
          }, {
            "new": true
          }));

        case 6:
          research = _context2.sent;
          res.json({
            message: "Research ".concat(status),
            research: research
          });
          _context2.next = 13;
          break;

        case 10:
          _context2.prev = 10;
          _context2.t0 = _context2["catch"](1);
          res.status(400).json({
            message: _context2.t0.message
          });

        case 13:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[1, 10]]);
}); // -------------------- UPDATE STAGE --------------------
// Adviser moves research to a new stage (e.g., Proposal, Defense, Final)

router.post("/stage", function _callee3(req, res) {
  var _req$body3, researchId, stage, research;

  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _req$body3 = req.body, researchId = _req$body3.researchId, stage = _req$body3.stage;
          _context3.prev = 1;
          _context3.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            stage: stage
          }, {
            "new": true
          }));

        case 4:
          research = _context3.sent;
          res.json({
            message: "Moved to Stage ".concat(stage),
            research: research
          });
          _context3.next = 11;
          break;

        case 8:
          _context3.prev = 8;
          _context3.t0 = _context3["catch"](1);
          res.status(400).json({
            message: _context3.t0.message
          });

        case 11:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[1, 8]]);
}); // -------------------- SCHEDULE CONSULTATION --------------------

router.post("/consultation", function _callee4(req, res) {
  var _req$body4, studentId, date, note, consultation;

  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _req$body4 = req.body, studentId = _req$body4.studentId, date = _req$body4.date, note = _req$body4.note;
          _context4.prev = 1;
          consultation = new Consultation({
            student: studentId,
            adviser: req.user._id,
            date: date,
            note: note
          });
          _context4.next = 5;
          return regeneratorRuntime.awrap(consultation.save());

        case 5:
          res.json({
            message: "Consultation Scheduled",
            consultation: consultation
          });
          _context4.next = 11;
          break;

        case 8:
          _context4.prev = 8;
          _context4.t0 = _context4["catch"](1);
          res.status(400).json({
            message: _context4.t0.message
          });

        case 11:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[1, 8]]);
}); // -------------------- VIEW CONSULTATION HISTORY --------------------

router.get("/consultations/:studentId", function _callee5(req, res) {
  var consultations;
  return regeneratorRuntime.async(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          _context5.next = 3;
          return regeneratorRuntime.awrap(Consultation.find({
            student: req.params.studentId,
            adviser: req.user._id
          }).populate("student adviser"));

        case 3:
          consultations = _context5.sent;
          res.json(consultations);
          _context5.next = 10;
          break;

        case 7:
          _context5.prev = 7;
          _context5.t0 = _context5["catch"](0);
          res.status(400).json({
            message: _context5.t0.message
          });

        case 10:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 7]]);
}); // -------------------- VIEW ASSIGNED RESEARCH --------------------

router.get("/my-research", function _callee6(req, res) {
  var research;
  return regeneratorRuntime.async(function _callee6$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          _context6.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].find({
            adviser: req.user._id
          }).populate("student adviser panel"));

        case 3:
          research = _context6.sent;
          res.json(research);
          _context6.next = 10;
          break;

        case 7:
          _context6.prev = 7;
          _context6.t0 = _context6["catch"](0);
          res.status(500).json({
            message: "Error fetching adviser research"
          });

        case 10:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[0, 7]]);
});
var _default = router;
exports["default"] = _default;