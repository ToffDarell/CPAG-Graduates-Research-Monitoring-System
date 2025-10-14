"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _auth = require("../middleware/auth.js");

var _Schedule = _interopRequireDefault(require("../models/Schedule.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router();
/**
 * Chairperson: Create schedule
 */


router.post("/", (0, _auth.checkAuth)(["chairperson"]), function _callee(req, res) {
  var _req$body, research, student, adviser, panel, type, date, location, schedule;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _req$body = req.body, research = _req$body.research, student = _req$body.student, adviser = _req$body.adviser, panel = _req$body.panel, type = _req$body.type, date = _req$body.date, location = _req$body.location;
          schedule = new _Schedule["default"]({
            research: research,
            student: student,
            adviser: adviser,
            panel: panel,
            chairperson: req.user._id,
            type: type,
            date: date,
            location: location
          });
          _context.next = 5;
          return regeneratorRuntime.awrap(schedule.save());

        case 5:
          res.status(201).json({
            message: "Schedule created",
            schedule: schedule
          });
          _context.next = 11;
          break;

        case 8:
          _context.prev = 8;
          _context.t0 = _context["catch"](0);
          res.status(500).json({
            message: "Error creating schedule",
            error: _context.t0.message
          });

        case 11:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 8]]);
});
/**
 * All roles: View schedules
 */

router.get("/", (0, _auth.checkAuth)(["student", "adviser", "panel", "chairperson"]), function _callee2(req, res) {
  var schedules;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 3;
          return regeneratorRuntime.awrap(_Schedule["default"].find().populate("research", "title").populate("student", "name email").populate("adviser", "name email").populate("panel", "name email").populate("chairperson", "name email"));

        case 3:
          schedules = _context2.sent;
          res.json(schedules);
          _context2.next = 10;
          break;

        case 7:
          _context2.prev = 7;
          _context2.t0 = _context2["catch"](0);
          res.status(500).json({
            message: "Error fetching schedules",
            error: _context2.t0.message
          });

        case 10:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 7]]);
});
/**
 * Chairperson: Update schedule
 */

router.put("/:id", (0, _auth.checkAuth)(["chairperson"]), function _callee3(req, res) {
  var schedule;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(_Schedule["default"].findByIdAndUpdate(req.params.id, req.body, {
            "new": true
          }));

        case 3:
          schedule = _context3.sent;

          if (schedule) {
            _context3.next = 6;
            break;
          }

          return _context3.abrupt("return", res.status(404).json({
            message: "Schedule not found"
          }));

        case 6:
          res.json({
            message: "Schedule updated",
            schedule: schedule
          });
          _context3.next = 12;
          break;

        case 9:
          _context3.prev = 9;
          _context3.t0 = _context3["catch"](0);
          res.status(500).json({
            message: "Error updating schedule",
            error: _context3.t0.message
          });

        case 12:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 9]]);
});
/**
 * Chairperson: Delete schedule
 */

router["delete"]("/:id", (0, _auth.checkAuth)(["chairperson"]), function _callee4(req, res) {
  var schedule;
  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          _context4.next = 3;
          return regeneratorRuntime.awrap(_Schedule["default"].findByIdAndDelete(req.params.id));

        case 3:
          schedule = _context4.sent;

          if (schedule) {
            _context4.next = 6;
            break;
          }

          return _context4.abrupt("return", res.status(404).json({
            message: "Schedule not found"
          }));

        case 6:
          res.json({
            message: "Schedule deleted"
          });
          _context4.next = 12;
          break;

        case 9:
          _context4.prev = 9;
          _context4.t0 = _context4["catch"](0);
          res.status(500).json({
            message: "Error deleting schedule",
            error: _context4.t0.message
          });

        case 12:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[0, 9]]);
});
var _default = router;
exports["default"] = _default;