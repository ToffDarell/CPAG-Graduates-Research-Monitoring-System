"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _auth = require("../middleware/auth.js");

var _Research = _interopRequireDefault(require("../models/Research.js"));

var _Grade = _interopRequireDefault(require("../models/Grade.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router(); //Assign adviser


router.post("/assign-adviser/", (0, _auth.checkAuth)(["instructor"]), function _callee(req, res) {
  var _req$body, researchId, adviserId, research;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _req$body = req.body, researchId = _req$body.researchId, adviserId = _req$body.adviserId;
          _context.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            adviser: adviserId
          }));

        case 3:
          research = _context.sent;
          res.json({
            message: "Adviser assigned",
            research: research
          });

        case 5:
        case "end":
          return _context.stop();
      }
    }
  });
}); // Give grade

router.post("/grade", (0, _auth.checkAuth)(["instructor"]), function _callee2(req, res) {
  var _req$body2, researchId, studentId, grade, remarks, newGrade;

  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _req$body2 = req.body, researchId = _req$body2.researchId, studentId = _req$body2.studentId, grade = _req$body2.grade, remarks = _req$body2.remarks;
          newGrade = new _Grade["default"]({
            research: researchId,
            student: studentId,
            instructor: req.user._id,
            grade: grade,
            remarks: remarks
          });
          _context2.next = 4;
          return regeneratorRuntime.awrap(newGrade.save());

        case 4:
          res.json({
            message: "Grade submitted",
            newGrade: newGrade
          });

        case 5:
        case "end":
          return _context2.stop();
      }
    }
  });
}); // Get grades by research

router.get("/grades/:researchId", (0, _auth.checkAuth)(["instructor", "student"]), function _callee3(req, res) {
  var grades;
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.next = 2;
          return regeneratorRuntime.awrap(_Grade["default"].find({
            research: req.params.researchId
          }).populate("student instructor", "name email"));

        case 2:
          grades = _context3.sent;
          res.json(grades);

        case 4:
        case "end":
          return _context3.stop();
      }
    }
  });
});
var _default = router;
exports["default"] = _default;