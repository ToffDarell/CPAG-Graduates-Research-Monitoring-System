"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _auth = require("../middleware/auth.js");

var _Minutes = _interopRequireDefault(require("../models/Minutes.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router(); //Upload meeting minutes


router.post("/upload-minutes", (0, _auth.checkAuth)(["secretary"]), function _callee(req, res) {
  var _req$body, meetingDate, researchId, notes, fileUrl, minutes;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _req$body = req.body, meetingDate = _req$body.meetingDate, researchId = _req$body.researchId, notes = _req$body.notes, fileUrl = _req$body.fileUrl;
          minutes = new _Minutes["default"]({
            meetingDate: meetingDate,
            research: researchId,
            notes: notes,
            fileUrl: fileUrl,
            secretary: req.user._id
          });
          _context.next = 4;
          return regeneratorRuntime.awrap(minutes.save());

        case 4:
          res.json({
            message: "Minutes uploaded",
            minutes: minutes
          });

        case 5:
        case "end":
          return _context.stop();
      }
    }
  });
}); //View Records

router.get("/records", (0, _auth.checkAuth)(["secretary"]), function _callee2(req, res) {
  var records;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.next = 2;
          return regeneratorRuntime.awrap(_Minutes["default"].find().populate("research secretary"));

        case 2:
          records = _context2.sent;
          res.json(records);

        case 4:
        case "end":
          return _context2.stop();
      }
    }
  });
});
var _default = router;
exports["default"] = _default;