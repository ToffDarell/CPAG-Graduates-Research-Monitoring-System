"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getAvailableDocuments = exports.getMyResearch = exports.getAdviserFeedback = exports.getMySchedules = exports.uploadChapter = exports.uploadComplianceForm = void 0;

var _Research = _interopRequireDefault(require("../models/Research.js"));

var _Feedback = _interopRequireDefault(require("../models/Feedback.js"));

var _Schedule = _interopRequireDefault(require("../models/Schedule.js"));

var _Document = _interopRequireDefault(require("../models/Document.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// Upload compliance form
var uploadComplianceForm = function uploadComplianceForm(req, res) {
  var researchId, research;
  return regeneratorRuntime.async(function uploadComplianceForm$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          console.log("Upload compliance form request:", req.body);
          console.log("Uploaded file:", req.file);

          if (req.file) {
            _context.next = 5;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            message: "No file uploaded"
          }));

        case 5:
          researchId = req.body.researchId;

          if (researchId) {
            _context.next = 8;
            break;
          }

          return _context.abrupt("return", res.status(400).json({
            message: "Research ID is required"
          }));

        case 8:
          _context.next = 10;
          return regeneratorRuntime.awrap(_Research["default"].findById(researchId));

        case 10:
          research = _context.sent;

          if (research) {
            _context.next = 13;
            break;
          }

          return _context.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 13:
          // Add file to research
          research.forms.push({
            filename: req.file.originalname,
            filepath: req.file.path,
            type: "compliance",
            status: "pending",
            uploadedBy: req.user.id,
            uploadedAt: new Date()
          });
          _context.next = 16;
          return regeneratorRuntime.awrap(research.save());

        case 16:
          res.json({
            message: "Compliance form uploaded successfully"
          });
          _context.next = 22;
          break;

        case 19:
          _context.prev = 19;
          _context.t0 = _context["catch"](0);
          res.status(500).json({
            message: _context.t0.message
          });

        case 22:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 19]]);
}; // Upload research chapter


exports.uploadComplianceForm = uploadComplianceForm;

var uploadChapter = function uploadChapter(req, res) {
  var _req$body, researchId, chapterType, research, chapterProgress;

  return regeneratorRuntime.async(function uploadChapter$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          console.log("Upload chapter request:", req.body);
          console.log("Uploaded file:", req.file);

          if (req.file) {
            _context2.next = 5;
            break;
          }

          return _context2.abrupt("return", res.status(400).json({
            message: "No file uploaded"
          }));

        case 5:
          _req$body = req.body, researchId = _req$body.researchId, chapterType = _req$body.chapterType;

          if (researchId) {
            _context2.next = 8;
            break;
          }

          return _context2.abrupt("return", res.status(400).json({
            message: "Research ID is required"
          }));

        case 8:
          _context2.next = 10;
          return regeneratorRuntime.awrap(_Research["default"].findById(researchId));

        case 10:
          research = _context2.sent;

          if (research) {
            _context2.next = 13;
            break;
          }

          return _context2.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 13:
          // Add file to research
          research.forms.push({
            filename: req.file.originalname,
            filepath: req.file.path,
            type: chapterType,
            // "chapter1", "chapter2", "chapter3"
            status: "pending",
            uploadedBy: req.user.id,
            uploadedAt: new Date()
          }); // Update progress based on chapter

          chapterProgress = {
            chapter1: 25,
            chapter2: 50,
            chapter3: 75
          };

          if (chapterProgress[chapterType]) {
            research.progress = Math.max(research.progress, chapterProgress[chapterType]);
          }

          _context2.next = 18;
          return regeneratorRuntime.awrap(research.save());

        case 18:
          res.json({
            message: "Chapter uploaded successfully"
          });
          _context2.next = 24;
          break;

        case 21:
          _context2.prev = 21;
          _context2.t0 = _context2["catch"](0);
          res.status(500).json({
            message: _context2.t0.message
          });

        case 24:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 21]]);
}; // Get my schedules


exports.uploadChapter = uploadChapter;

var getMySchedules = function getMySchedules(req, res) {
  var schedules;
  return regeneratorRuntime.async(function getMySchedules$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(_Schedule["default"].find({
            "participants.user": req.user.id
          }).populate("research", "title").populate("participants.user", "name email").sort({
            datetime: 1
          }));

        case 3:
          schedules = _context3.sent;
          res.json(schedules);
          _context3.next = 10;
          break;

        case 7:
          _context3.prev = 7;
          _context3.t0 = _context3["catch"](0);
          res.status(500).json({
            message: _context3.t0.message
          });

        case 10:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 7]]);
}; // Get adviser feedback


exports.getMySchedules = getMySchedules;

var getAdviserFeedback = function getAdviserFeedback(req, res) {
  var feedback;
  return regeneratorRuntime.async(function getAdviserFeedback$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          _context4.next = 3;
          return regeneratorRuntime.awrap(_Feedback["default"].find({
            student: req.user.id
          }).populate("research", "title").populate("adviser", "name").sort({
            createdAt: -1
          }));

        case 3:
          feedback = _context4.sent;
          res.json(feedback);
          _context4.next = 10;
          break;

        case 7:
          _context4.prev = 7;
          _context4.t0 = _context4["catch"](0);
          res.status(500).json({
            message: _context4.t0.message
          });

        case 10:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[0, 7]]);
}; // Get my research


exports.getAdviserFeedback = getAdviserFeedback;

var getMyResearch = function getMyResearch(req, res) {
  var research;
  return regeneratorRuntime.async(function getMyResearch$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          _context5.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].find({
            students: req.user.id
          }).populate("adviser", "name email").sort({
            updatedAt: -1
          }));

        case 3:
          research = _context5.sent;
          res.json(research);
          _context5.next = 10;
          break;

        case 7:
          _context5.prev = 7;
          _context5.t0 = _context5["catch"](0);
          res.status(500).json({
            message: _context5.t0.message
          });

        case 10:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 7]]);
}; // Get available documents


exports.getMyResearch = getMyResearch;

var getAvailableDocuments = function getAvailableDocuments(req, res) {
  var documents;
  return regeneratorRuntime.async(function getAvailableDocuments$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          _context6.next = 3;
          return regeneratorRuntime.awrap(_Document["default"].find({
            isActive: true,
            accessibleTo: {
              $in: ["graduate student"]
            }
          }).populate("uploadedBy", "name").sort({
            createdAt: -1
          }));

        case 3:
          documents = _context6.sent;
          res.json(documents);
          _context6.next = 10;
          break;

        case 7:
          _context6.prev = 7;
          _context6.t0 = _context6["catch"](0);
          res.status(500).json({
            message: _context6.t0.message
          });

        case 10:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[0, 7]]);
};

exports.getAvailableDocuments = getAvailableDocuments;