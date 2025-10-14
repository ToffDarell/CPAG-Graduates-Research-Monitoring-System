"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getDetailedStudentInfo = exports.getMyStudents = exports.getConsultationSchedules = exports.uploadFeedback = exports.approveRejectSubmission = exports.updateThesisStatus = exports.getStudentSubmissions = void 0;

var _Research = _interopRequireDefault(require("../models/Research.js"));

var _Feedback = _interopRequireDefault(require("../models/Feedback.js"));

var _Schedule = _interopRequireDefault(require("../models/Schedule.js"));

var _User = _interopRequireDefault(require("../models/User.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// Get student submissions
var getStudentSubmissions = function getStudentSubmissions(req, res) {
  var research;
  return regeneratorRuntime.async(function getStudentSubmissions$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].find({
            adviser: req.user.id,
            forms: {
              $exists: true,
              $not: {
                $size: 0
              }
            } // Only return research with forms

          }).populate("students", "name email").sort({
            updatedAt: -1
          }));

        case 3:
          research = _context.sent;
          res.json(research);
          _context.next = 10;
          break;

        case 7:
          _context.prev = 7;
          _context.t0 = _context["catch"](0);
          res.status(500).json({
            message: _context.t0.message
          });

        case 10:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[0, 7]]);
}; // Update thesis status


exports.getStudentSubmissions = getStudentSubmissions;

var updateThesisStatus = function updateThesisStatus(req, res) {
  var id, _req$body, status, stage, progress, research;

  return regeneratorRuntime.async(function updateThesisStatus$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          id = req.params.id;
          _req$body = req.body, status = _req$body.status, stage = _req$body.stage, progress = _req$body.progress;
          _context2.next = 5;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(id, {
            status: status,
            stage: stage,
            progress: progress
          }, {
            "new": true
          }).populate("students", "name email"));

        case 5:
          research = _context2.sent;
          res.json({
            message: "Thesis status updated successfully",
            research: research
          });
          _context2.next = 12;
          break;

        case 9:
          _context2.prev = 9;
          _context2.t0 = _context2["catch"](0);
          res.status(500).json({
            message: _context2.t0.message
          });

        case 12:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 9]]);
}; // Approve/reject submission


exports.updateThesisStatus = updateThesisStatus;

var approveRejectSubmission = function approveRejectSubmission(req, res) {
  var _req$body2, researchId, fileId, action, message, research, file, feedback;

  return regeneratorRuntime.async(function approveRejectSubmission$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _req$body2 = req.body, researchId = _req$body2.researchId, fileId = _req$body2.fileId, action = _req$body2.action, message = _req$body2.message;
          _context3.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findById(researchId));

        case 4:
          research = _context3.sent;

          if (research) {
            _context3.next = 7;
            break;
          }

          return _context3.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 7:
          file = research.files.id(fileId);

          if (file) {
            _context3.next = 10;
            break;
          }

          return _context3.abrupt("return", res.status(404).json({
            message: "File not found"
          }));

        case 10:
          file.status = action; // "approved" or "rejected"

          _context3.next = 13;
          return regeneratorRuntime.awrap(research.save());

        case 13:
          // Create feedback record
          feedback = new _Feedback["default"]({
            research: researchId,
            student: research.students[0],
            // Assuming single student for now
            adviser: req.user.id,
            type: action === "approved" ? "approval" : "rejection",
            message: message
          });
          _context3.next = 16;
          return regeneratorRuntime.awrap(feedback.save());

        case 16:
          res.json({
            message: "Submission ".concat(action, " successfully"),
            feedback: feedback
          });
          _context3.next = 22;
          break;

        case 19:
          _context3.prev = 19;
          _context3.t0 = _context3["catch"](0);
          res.status(500).json({
            message: _context3.t0.message
          });

        case 22:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 19]]);
}; // Upload feedback


exports.approveRejectSubmission = approveRejectSubmission;

var uploadFeedback = function uploadFeedback(req, res) {
  var _req$body3, researchId, message, type, research, feedback;

  return regeneratorRuntime.async(function uploadFeedback$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          _req$body3 = req.body, researchId = _req$body3.researchId, message = _req$body3.message, type = _req$body3.type;
          _context4.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findById(researchId));

        case 4:
          research = _context4.sent;

          if (research) {
            _context4.next = 7;
            break;
          }

          return _context4.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 7:
          feedback = new _Feedback["default"]({
            research: researchId,
            student: research.students[0],
            adviser: req.user.id,
            type: type || "feedback",
            message: message,
            file: req.file ? {
              filename: req.file.originalname,
              filepath: req.file.path
            } : undefined
          });
          _context4.next = 10;
          return regeneratorRuntime.awrap(feedback.save());

        case 10:
          res.json({
            message: "Feedback uploaded successfully",
            feedback: feedback
          });
          _context4.next = 16;
          break;

        case 13:
          _context4.prev = 13;
          _context4.t0 = _context4["catch"](0);
          res.status(500).json({
            message: _context4.t0.message
          });

        case 16:
        case "end":
          return _context4.stop();
      }
    }
  }, null, null, [[0, 13]]);
}; // Get consultation schedules


exports.uploadFeedback = uploadFeedback;

var getConsultationSchedules = function getConsultationSchedules(req, res) {
  var schedules;
  return regeneratorRuntime.async(function getConsultationSchedules$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          _context5.next = 3;
          return regeneratorRuntime.awrap(_Schedule["default"].find({
            "participants.user": req.user.id,
            type: "consultation"
          }).populate("research", "title students").populate("participants.user", "name email").sort({
            datetime: 1
          }));

        case 3:
          schedules = _context5.sent;
          res.json(schedules);
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
}; // Get my students (modified to include research titles)


exports.getConsultationSchedules = getConsultationSchedules;

var getMyStudents = function getMyStudents(req, res) {
  var research;
  return regeneratorRuntime.async(function getMyStudents$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          console.log("Getting assigned students for faculty:", req.user.id);
          _context6.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].find({
            adviser: req.user.id,
            status: {
              $ne: 'archived'
            } // Exclude archived research

          }).populate("students", "name email").populate("adviser", "name email").select("title students status stage progress updatedAt"));

        case 4:
          research = _context6.sent;
          console.log("Found research assignments:", research);
          res.json(research);
          _context6.next = 13;
          break;

        case 9:
          _context6.prev = 9;
          _context6.t0 = _context6["catch"](0);
          console.error('Error fetching students:', _context6.t0);
          res.status(500).json({
            message: _context6.t0.message
          });

        case 13:
        case "end":
          return _context6.stop();
      }
    }
  }, null, null, [[0, 9]]);
}; // Get detailed student information


exports.getMyStudents = getMyStudents;

var getDetailedStudentInfo = function getDetailedStudentInfo(req, res) {
  var research, studentDetails;
  return regeneratorRuntime.async(function getDetailedStudentInfo$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.prev = 0;
          _context7.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].find({
            adviser: req.user.id
          }).populate("students", "name email").populate("adviser", "name email ").select("title description status stage progress startDate endDate createdAt updatedAt"));

        case 3:
          research = _context7.sent;
          // Group research by student for better organization
          studentDetails = research.reduce(function (acc, curr) {
            curr.students.forEach(function (student) {
              if (!acc[student._id]) {
                acc[student._id] = {
                  student: {
                    id: student._id,
                    name: student.name,
                    email: student.email
                  },
                  research: []
                };
              }

              acc[student._id].research.push({
                id: curr._id,
                title: curr.title,
                description: curr.description,
                status: curr.status,
                stage: curr.stage,
                progress: curr.progress,
                startDate: curr.startDate,
                endDate: curr.endDate,
                createdAt: curr.createdAt,
                updatedAt: curr.updatedAt
              });
            });
            return acc;
          }, {});
          res.json(Object.values(studentDetails));
          _context7.next = 11;
          break;

        case 8:
          _context7.prev = 8;
          _context7.t0 = _context7["catch"](0);
          res.status(500).json({
            message: _context7.t0.message
          });

        case 11:
        case "end":
          return _context7.stop();
      }
    }
  }, null, null, [[0, 8]]);
};

exports.getDetailedStudentInfo = getDetailedStudentInfo;