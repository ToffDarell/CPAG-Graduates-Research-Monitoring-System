"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _auth = require("../middleware/auth.js");

var _Research = _interopRequireDefault(require("../models/Research.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router(); // Panel feedback route


router.post("/feedback", (0, _auth.checkAuth)(["panel"]), function _callee(req, res) {
  var _req$body, researchId, comment, research;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _req$body = req.body, researchId = _req$body.researchId, comment = _req$body.comment; // Ensure required data

          if (!(!researchId || !comment)) {
            _context.next = 4;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            message: "researchId and comment required"
          }));

        case 4:
          _context.next = 6;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            $push: {
              feedback: {
                comment: comment,
                panel: req.user._id // comes from checkAuth middleware

              }
            }
          }, {
            "new": true
          } // return updated doc
          ).populate("feedback.panel", "name email"));

        case 6:
          research = _context.sent;

          if (research) {
            _context.next = 9;
            break;
          }

          return _context.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 9:
          res.json({
            message: "Feedback submitted",
            research: research
          });
          _context.next = 16;
          break;

        case 12:
          _context.prev = 12;
          _context.t0 = _context["catch"](0);
          console.error(_context.t0);
          res.status(500).json({
            message: "Server error"
          });

        case 16:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 12]]);
});
var _default = router;
exports["default"] = _default;