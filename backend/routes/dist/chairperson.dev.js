"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _auth = require("../middleware/auth.js");

var _Research = _interopRequireDefault(require("../models/Research.js"));

var _Schedule = _interopRequireDefault(require("../models/Schedule.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router(); // Create schedule


router.post("/schedule", (0, _auth.checkAuth)(["chairperson"]), function _callee(req, res) {
  var _req$body, researchId, participants, type, datetime, schedule;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _req$body = req.body, researchId = _req$body.researchId, participants = _req$body.participants, type = _req$body.type, datetime = _req$body.datetime;
          schedule = new _Schedule["default"]({
            research: researchId,
            participants: participants,
            type: type,
            datetime: datetime
          });
          _context.next = 4;
          return regeneratorRuntime.awrap(schedule.save());

        case 4:
          res.json({
            message: "Schedule created",
            schedule: schedule
          });

        case 5:
        case "end":
          return _context.stop();
      }
    }
  });
}); // Get all schedules

router.get("/schedules", (0, _auth.checkAuth)(["chairperson", "adviser", "student", "panel"]), function _callee2(req, res) {
  var schedules;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(_Schedule["default"].find().populate("research participants", "title name email"));

        case 2:
          schedules = _context2.sent;
          res.json(schedules);

        case 4:
        case "end":
          return _context2.stop();
      }
    }
  });
}); //Selecr panel members

router.post("/select-panel", (0, _auth.checkAuth)(["chairperson"]), function _callee3(req, res) {
  var _req$body2, researchId, panelIds, research;

  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _req$body2 = req.body, researchId = _req$body2.researchId, panelIds = _req$body2.panelIds;
          _context3.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            panel: panelIds
          }));

        case 3:
          research = _context3.sent;
          res.json({
            message: "Panel assigned",
            research: research
          });

        case 5:
        case "end":
          return _context3.stop();
      }
    }
  });
}); //Finalize schedule

router.post("/finalize-schedule", (0, _auth.checkAuth)(["chairperson"]), function _callee4(req, res) {
  var _req$body3, researchId, date, research;

  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _req$body3 = req.body, researchId = _req$body3.researchId, date = _req$body3.date;
          _context4.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            schedule: date
          }));

        case 3:
          research = _context4.sent;
          res.json({
            message: "Schedule finalized",
            research: research
          });

        case 5:
        case "end":
          return _context4.stop();
      }
    }
  });
});
var _default = router;
exports["default"] = _default;