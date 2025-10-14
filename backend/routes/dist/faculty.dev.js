"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _multer = _interopRequireDefault(require("multer"));

var _path = _interopRequireDefault(require("path"));

var _auth = require("../middleware/auth.js");

var _facultyController = require("../controllers/facultyController.js");

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

router.use(_auth.protect, (0, _auth.checkAuth)(["faculty adviser"])); // Student submissions

router.get("/submissions", _facultyController.getStudentSubmissions); // Thesis status management

router.put("/thesis/:id/status", _facultyController.updateThesisStatus); // Approve/reject submissions

router.post("/submissions/approve-reject", _facultyController.approveRejectSubmission); // Feedback management

router.post("/feedback", upload.single("file"), _facultyController.uploadFeedback); // Consultation schedules

router.get("/schedules", _facultyController.getConsultationSchedules); // My students

router.get("/students", _facultyController.getMyStudents);
var _default = router;
exports["default"] = _default;