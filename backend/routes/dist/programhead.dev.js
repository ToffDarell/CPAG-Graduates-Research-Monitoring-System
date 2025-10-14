"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _multer = _interopRequireDefault(require("multer"));

var _path = _interopRequireDefault(require("path"));

var _auth = require("../middleware/auth.js");

var _Research = _interopRequireDefault(require("../models/Research.js"));

var _Schedule = _interopRequireDefault(require("../models/Schedule.js"));

var _User = _interopRequireDefault(require("../models/User.js"));

var _programHeadController = require("../controllers/programHeadController.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var router = _express["default"].Router(); // Configure multer for file uploads


var storage = _multer["default"].diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function filename(req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

var upload = (0, _multer["default"])({
  storage: storage
}); // Apply authentication middleware to all routes

router.use(_auth.protect, (0, _auth.checkAuth)(["program head"])); // Panel management

router.get("/panels", _programHeadController.getPanelMembers);
router.post("/panels/assign", _programHeadController.assignPanelMembers); // Schedule management

router.get("/schedules", _programHeadController.getSchedules);
router.post("/schedules", _programHeadController.createSchedule);
router.put("/schedules/:id", _programHeadController.updateSchedule);
router["delete"]("/schedules/:id", _programHeadController.deleteSchedule); // Process monitoring

router.get("/monitoring", _programHeadController.getProcessMonitoring); // Forms and documents

router.post("/forms", upload.single("file"), _programHeadController.uploadForm); // Research records

router.get("/research", _programHeadController.getResearchRecords); // Faculty adviser management

router.get("/advisers", _programHeadController.getAvailableAdvisers);
router.post("/assign-adviser", _programHeadController.assignAdviser);
router.post("/remove-adviser", _programHeadController.removeAdviser); // Research records management

router.post("/share-with-dean", _programHeadController.shareWithDean);
router.put("/archive/:id", _programHeadController.archiveResearch); // Research title and student management

router.post("/research", _programHeadController.createResearchTitle);
router.get("/students", _programHeadController.getStudents);
router.post("/research/add-students", _programHeadController.addStudentsToResearch);
var _default = router;
exports["default"] = _default;