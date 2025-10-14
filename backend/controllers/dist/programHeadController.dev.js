"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.addStudentsToResearch = exports.getStudents = exports.createResearchTitle = exports.archiveResearch = exports.shareWithDean = exports.removeAdviser = exports.assignAdviser = exports.getAvailableAdvisers = exports.getResearchRecords = exports.uploadForm = exports.getProcessMonitoring = exports.deleteSchedule = exports.updateSchedule = exports.createSchedule = exports.getSchedules = exports.assignPanelMembers = exports.getPanelMembers = void 0;

var _Panel = _interopRequireDefault(require("../models/Panel.js"));

var _Schedule = _interopRequireDefault(require("../models/Schedule.js"));

var _Research = _interopRequireDefault(require("../models/Research.js"));

var _User = _interopRequireDefault(require("../models/User.js"));

var _Document = _interopRequireDefault(require("../models/Document.js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(source, true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(source).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// Get panel members
var getPanelMembers = function getPanelMembers(req, res) {
  var panels;
  return regeneratorRuntime.async(function getPanelMembers$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _context.prev = 0;
          _context.next = 3;
          return regeneratorRuntime.awrap(_Panel["default"].find().populate("research", "title students").populate("members.faculty", "name email").sort({
            createdAt: -1
          }));

        case 3:
          panels = _context.sent;
          res.json(panels);
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
}; // Assign panel members


exports.getPanelMembers = getPanelMembers;

var assignPanelMembers = function assignPanelMembers(req, res) {
  var _req$body, researchId, members, panel;

  return regeneratorRuntime.async(function assignPanelMembers$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _req$body = req.body, researchId = _req$body.researchId, members = _req$body.members; // Check if panel already exists

          _context2.next = 4;
          return regeneratorRuntime.awrap(_Panel["default"].findOne({
            research: researchId
          }));

        case 4:
          panel = _context2.sent;

          if (panel) {
            panel.members = members;
            panel.assignedBy = req.user.id;
          } else {
            panel = new _Panel["default"]({
              research: researchId,
              members: members,
              assignedBy: req.user.id
            });
          }

          _context2.next = 8;
          return regeneratorRuntime.awrap(panel.save());

        case 8:
          res.json({
            message: "Panel members assigned successfully",
            panel: panel
          });
          _context2.next = 14;
          break;

        case 11:
          _context2.prev = 11;
          _context2.t0 = _context2["catch"](0);
          res.status(500).json({
            message: _context2.t0.message
          });

        case 14:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 11]]);
}; // Get schedules


exports.assignPanelMembers = assignPanelMembers;

var getSchedules = function getSchedules(req, res) {
  var schedules;
  return regeneratorRuntime.async(function getSchedules$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(_Schedule["default"].find().populate("research", "title students").populate("participants.user", "name email").populate("createdBy", "name").sort({
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
}; // Create schedule


exports.getSchedules = getSchedules;

var createSchedule = function createSchedule(req, res) {
  var schedule;
  return regeneratorRuntime.async(function createSchedule$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.prev = 0;
          schedule = new _Schedule["default"](_objectSpread({}, req.body, {
            createdBy: req.user.id
          }));
          _context4.next = 4;
          return regeneratorRuntime.awrap(schedule.save());

        case 4:
          res.json({
            message: "Schedule created successfully",
            schedule: schedule
          });
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
}; // Update schedule


exports.createSchedule = createSchedule;

var updateSchedule = function updateSchedule(req, res) {
  var id, schedule;
  return regeneratorRuntime.async(function updateSchedule$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.prev = 0;
          id = req.params.id;
          _context5.next = 4;
          return regeneratorRuntime.awrap(_Schedule["default"].findByIdAndUpdate(id, req.body, {
            "new": true
          }));

        case 4:
          schedule = _context5.sent;
          res.json({
            message: "Schedule updated successfully",
            schedule: schedule
          });
          _context5.next = 11;
          break;

        case 8:
          _context5.prev = 8;
          _context5.t0 = _context5["catch"](0);
          res.status(500).json({
            message: _context5.t0.message
          });

        case 11:
        case "end":
          return _context5.stop();
      }
    }
  }, null, null, [[0, 8]]);
}; // Delete schedule


exports.updateSchedule = updateSchedule;

var deleteSchedule = function deleteSchedule(req, res) {
  var id;
  return regeneratorRuntime.async(function deleteSchedule$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.prev = 0;
          id = req.params.id;
          _context6.next = 4;
          return regeneratorRuntime.awrap(_Schedule["default"].findByIdAndDelete(id));

        case 4:
          res.json({
            message: "Schedule deleted successfully"
          });
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
}; // Get process monitoring data


exports.deleteSchedule = deleteSchedule;

var getProcessMonitoring = function getProcessMonitoring(req, res) {
  var research, schedules, stats;
  return regeneratorRuntime.async(function getProcessMonitoring$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.prev = 0;
          _context7.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].find().populate("students", "name email").populate("adviser", "name email").sort({
            updatedAt: -1
          }));

        case 3:
          research = _context7.sent;
          _context7.next = 6;
          return regeneratorRuntime.awrap(_Schedule["default"].find().populate("research", "title").sort({
            datetime: 1
          }));

        case 6:
          schedules = _context7.sent;
          stats = {
            total: research.length,
            completed: research.filter(function (r) {
              return r.status === "completed";
            }).length,
            inProgress: research.filter(function (r) {
              return r.status === "in-progress";
            }).length,
            pending: research.filter(function (r) {
              return r.status === "pending";
            }).length
          };
          res.json({
            research: research,
            schedules: schedules,
            stats: stats
          });
          _context7.next = 14;
          break;

        case 11:
          _context7.prev = 11;
          _context7.t0 = _context7["catch"](0);
          res.status(500).json({
            message: _context7.t0.message
          });

        case 14:
        case "end":
          return _context7.stop();
      }
    }
  }, null, null, [[0, 11]]);
}; // Upload form


exports.getProcessMonitoring = getProcessMonitoring;

var uploadForm = function uploadForm(req, res) {
  var document;
  return regeneratorRuntime.async(function uploadForm$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          _context8.prev = 0;

          if (req.file) {
            _context8.next = 3;
            break;
          }

          return _context8.abrupt("return", res.status(400).json({
            message: "No file uploaded"
          }));

        case 3:
          document = new _Document["default"]({
            title: req.body.title,
            description: req.body.description,
            category: "form",
            filename: req.file.originalname,
            filepath: req.file.path,
            fileSize: req.file.size,
            mimeType: req.file.mimetype,
            uploadedBy: req.user.id,
            accessibleTo: ["admin/dean", "program head", "faculty adviser"]
          });
          _context8.next = 6;
          return regeneratorRuntime.awrap(document.save());

        case 6:
          res.json({
            message: "Form uploaded successfully",
            document: document
          });
          _context8.next = 12;
          break;

        case 9:
          _context8.prev = 9;
          _context8.t0 = _context8["catch"](0);
          res.status(500).json({
            message: _context8.t0.message
          });

        case 12:
        case "end":
          return _context8.stop();
      }
    }
  }, null, null, [[0, 9]]);
}; // Get research records


exports.uploadForm = uploadForm;

var getResearchRecords = function getResearchRecords(req, res) {
  var research;
  return regeneratorRuntime.async(function getResearchRecords$(_context9) {
    while (1) {
      switch (_context9.prev = _context9.next) {
        case 0:
          _context9.prev = 0;
          _context9.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].find().populate("students", "name email").populate("adviser", "name email").sort({
            createdAt: -1
          }));

        case 3:
          research = _context9.sent;
          res.json(research);
          _context9.next = 10;
          break;

        case 7:
          _context9.prev = 7;
          _context9.t0 = _context9["catch"](0);
          res.status(500).json({
            message: _context9.t0.message
          });

        case 10:
        case "end":
          return _context9.stop();
      }
    }
  }, null, null, [[0, 7]]);
}; // Get available faculty advisers


exports.getResearchRecords = getResearchRecords;

var getAvailableAdvisers = function getAvailableAdvisers(req, res) {
  var advisers;
  return regeneratorRuntime.async(function getAvailableAdvisers$(_context10) {
    while (1) {
      switch (_context10.prev = _context10.next) {
        case 0:
          _context10.prev = 0;
          _context10.next = 3;
          return regeneratorRuntime.awrap(_User["default"].find({
            role: "faculty adviser",
            isActive: true
          }).select("name email"));

        case 3:
          advisers = _context10.sent;
          res.json(advisers);
          _context10.next = 10;
          break;

        case 7:
          _context10.prev = 7;
          _context10.t0 = _context10["catch"](0);
          res.status(500).json({
            message: _context10.t0.message
          });

        case 10:
        case "end":
          return _context10.stop();
      }
    }
  }, null, null, [[0, 7]]);
}; // Assign faculty adviser to research


exports.getAvailableAdvisers = getAvailableAdvisers;

var assignAdviser = function assignAdviser(req, res) {
  var _req$body2, researchId, adviserId, research;

  return regeneratorRuntime.async(function assignAdviser$(_context11) {
    while (1) {
      switch (_context11.prev = _context11.next) {
        case 0:
          _context11.prev = 0;
          _req$body2 = req.body, researchId = _req$body2.researchId, adviserId = _req$body2.adviserId;
          _context11.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            adviser: adviserId
          }, {
            "new": true
          }).populate("students", "name email").populate("adviser", "name email"));

        case 4:
          research = _context11.sent;

          if (research) {
            _context11.next = 7;
            break;
          }

          return _context11.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 7:
          res.json({
            message: "Adviser assigned successfully",
            research: research
          });
          _context11.next = 13;
          break;

        case 10:
          _context11.prev = 10;
          _context11.t0 = _context11["catch"](0);
          res.status(500).json({
            message: _context11.t0.message
          });

        case 13:
        case "end":
          return _context11.stop();
      }
    }
  }, null, null, [[0, 10]]);
}; // Remove faculty adviser from research


exports.assignAdviser = assignAdviser;

var removeAdviser = function removeAdviser(req, res) {
  var researchId, research;
  return regeneratorRuntime.async(function removeAdviser$(_context12) {
    while (1) {
      switch (_context12.prev = _context12.next) {
        case 0:
          _context12.prev = 0;
          researchId = req.body.researchId;
          _context12.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            adviser: null
          }, {
            "new": true
          }).populate("students", "name email").populate("adviser", "name email"));

        case 4:
          research = _context12.sent;

          if (research) {
            _context12.next = 7;
            break;
          }

          return _context12.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 7:
          res.json({
            message: "Adviser removed successfully",
            research: research
          });
          _context12.next = 13;
          break;

        case 10:
          _context12.prev = 10;
          _context12.t0 = _context12["catch"](0);
          res.status(500).json({
            message: _context12.t0.message
          });

        case 13:
        case "end":
          return _context12.stop();
      }
    }
  }, null, null, [[0, 10]]);
}; // Share research record with Dean


exports.removeAdviser = removeAdviser;

var shareWithDean = function shareWithDean(req, res) {
  var researchId, research;
  return regeneratorRuntime.async(function shareWithDean$(_context13) {
    while (1) {
      switch (_context13.prev = _context13.next) {
        case 0:
          _context13.prev = 0;
          researchId = req.body.researchId;
          _context13.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            sharedWithDean: true,
            sharedAt: new Date(),
            sharedBy: req.user.id
          }, {
            "new": true
          }).populate("students", "name email").populate("adviser", "name email"));

        case 4:
          research = _context13.sent;

          if (research) {
            _context13.next = 7;
            break;
          }

          return _context13.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 7:
          res.json({
            message: "Research shared with Dean successfully",
            research: research
          });
          _context13.next = 13;
          break;

        case 10:
          _context13.prev = 10;
          _context13.t0 = _context13["catch"](0);
          res.status(500).json({
            message: _context13.t0.message
          });

        case 13:
        case "end":
          return _context13.stop();
      }
    }
  }, null, null, [[0, 10]]);
}; // Archive research


exports.shareWithDean = shareWithDean;

var archiveResearch = function archiveResearch(req, res) {
  var id, research;
  return regeneratorRuntime.async(function archiveResearch$(_context14) {
    while (1) {
      switch (_context14.prev = _context14.next) {
        case 0:
          _context14.prev = 0;
          id = req.params.id;
          _context14.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(id, {
            status: "archived",
            archivedAt: new Date(),
            archivedBy: req.user.id
          }, {
            "new": true
          }).populate("students", "name email").populate("adviser", "name email"));

        case 4:
          research = _context14.sent;

          if (research) {
            _context14.next = 7;
            break;
          }

          return _context14.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 7:
          res.json({
            message: "Research archived successfully",
            research: research
          });
          _context14.next = 13;
          break;

        case 10:
          _context14.prev = 10;
          _context14.t0 = _context14["catch"](0);
          res.status(500).json({
            message: _context14.t0.message
          });

        case 13:
        case "end":
          return _context14.stop();
      }
    }
  }, null, null, [[0, 10]]);
}; // Create new research title with students


exports.archiveResearch = archiveResearch;

var createResearchTitle = function createResearchTitle(req, res) {
  var _req$body3, title, studentIds, research, populatedResearch;

  return regeneratorRuntime.async(function createResearchTitle$(_context15) {
    while (1) {
      switch (_context15.prev = _context15.next) {
        case 0:
          _context15.prev = 0;
          _req$body3 = req.body, title = _req$body3.title, studentIds = _req$body3.studentIds;
          research = new _Research["default"]({
            title: title,
            students: studentIds,
            status: 'pending'
          });
          _context15.next = 5;
          return regeneratorRuntime.awrap(research.save());

        case 5:
          _context15.next = 7;
          return regeneratorRuntime.awrap(_Research["default"].findById(research._id).populate("students", "name email").populate("adviser", "name email"));

        case 7:
          populatedResearch = _context15.sent;
          res.status(201).json({
            message: "Research title created successfully",
            research: populatedResearch
          });
          _context15.next = 14;
          break;

        case 11:
          _context15.prev = 11;
          _context15.t0 = _context15["catch"](0);
          res.status(500).json({
            message: _context15.t0.message
          });

        case 14:
        case "end":
          return _context15.stop();
      }
    }
  }, null, null, [[0, 11]]);
}; // Get all students


exports.createResearchTitle = createResearchTitle;

var getStudents = function getStudents(req, res) {
  var students;
  return regeneratorRuntime.async(function getStudents$(_context16) {
    while (1) {
      switch (_context16.prev = _context16.next) {
        case 0:
          _context16.prev = 0;
          _context16.next = 3;
          return regeneratorRuntime.awrap(_User["default"].find({
            role: "graduate student" // Exact match with database role

          }).select("name email"));

        case 3:
          students = _context16.sent;
          // Add debugging logs
          console.log("Found graduate students:", students);
          res.json(students);
          _context16.next = 12;
          break;

        case 8:
          _context16.prev = 8;
          _context16.t0 = _context16["catch"](0);
          console.error("Error fetching students:", _context16.t0);
          res.status(500).json({
            message: _context16.t0.message
          });

        case 12:
        case "end":
          return _context16.stop();
      }
    }
  }, null, null, [[0, 8]]);
}; // Add students to research


exports.getStudents = getStudents;

var addStudentsToResearch = function addStudentsToResearch(req, res) {
  var _req$body4, researchId, studentIds, research;

  return regeneratorRuntime.async(function addStudentsToResearch$(_context17) {
    while (1) {
      switch (_context17.prev = _context17.next) {
        case 0:
          _context17.prev = 0;
          _req$body4 = req.body, researchId = _req$body4.researchId, studentIds = _req$body4.studentIds;
          _context17.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(researchId, {
            $set: {
              students: studentIds
            }
          }, {
            "new": true
          }).populate("students", "name email").populate("adviser", "name email"));

        case 4:
          research = _context17.sent;

          if (research) {
            _context17.next = 7;
            break;
          }

          return _context17.abrupt("return", res.status(404).json({
            message: "Research not found"
          }));

        case 7:
          res.json({
            message: "Students added successfully",
            research: research
          });
          _context17.next = 13;
          break;

        case 10:
          _context17.prev = 10;
          _context17.t0 = _context17["catch"](0);
          res.status(500).json({
            message: _context17.t0.message
          });

        case 13:
        case "end":
          return _context17.stop();
      }
    }
  }, null, null, [[0, 10]]);
};

exports.addStudentsToResearch = addStudentsToResearch;