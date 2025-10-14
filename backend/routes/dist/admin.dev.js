"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _express = _interopRequireDefault(require("express"));

var _User = _interopRequireDefault(require("../models/User.js"));

var _Research = _interopRequireDefault(require("../models/Research.js"));

var _auth = require("../middleware/auth.js");

var _nodemailer = _interopRequireDefault(require("nodemailer"));

var _multer = _interopRequireDefault(require("multer"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// Fixed import
var router = _express["default"].Router(); // Configure multer for file uploads


var storage = _multer["default"].diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function filename(req, file, cb) {
    cb(null, Date.now() + _path["default"].extname(file.originalname));
  }
});

var upload = (0, _multer["default"])({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  // 5MB limit
  fileFilter: function fileFilter(req, file, cb) {
    var allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    var extname = allowedTypes.test(_path["default"].extname(file.originalname).toLowerCase());

    if (extname) {
      return cb(null, true);
    }

    cb(new Error("Invalid file type!"));
  }
}); // Create transporter outside route handlers for reuse

var transporter = _nodemailer["default"].createTransport({
  // Configure your email service here
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
}); // -------------------- AUTH PROTECTION --------------------


router.use(_auth.protect, (0, _auth.checkAuth)(["Admin/Dean"])); // Fixed middleware usage
// ✅ Every route below requires Admin/Dean role
// -------------------- MANAGE FACULTY ACCOUNTS --------------------
// Add faculty account

router.post("/faculty", function _callee(req, res) {
  var _req$body, name, email, role, password, user;

  return regeneratorRuntime.async(function _callee$(_context) {
    while (1) {
      switch (_context.prev = _context.next) {
        case 0:
          _req$body = req.body, name = _req$body.name, email = _req$body.email, role = _req$body.role, password = _req$body.password;
          _context.prev = 1;
          user = new _User["default"]({
            name: name,
            email: email,
            role: role,
            password: password
          });
          _context.next = 5;
          return regeneratorRuntime.awrap(user.save());

        case 5:
          res.json({
            message: "Faculty account created",
            user: user
          });
          _context.next = 11;
          break;

        case 8:
          _context.prev = 8;
          _context.t0 = _context["catch"](1);
          res.status(400).json({
            message: _context.t0.message
          });

        case 11:
        case "end":
          return _context.stop();
      }
    }
  }, null, null, [[1, 8]]);
}); // Update faculty account

router.put("/faculty/:id", function _callee2(req, res) {
  var updated;
  return regeneratorRuntime.async(function _callee2$(_context2) {
    while (1) {
      switch (_context2.prev = _context2.next) {
        case 0:
          _context2.prev = 0;
          _context2.next = 3;
          return regeneratorRuntime.awrap(_User["default"].findByIdAndUpdate(req.params.id, req.body, {
            "new": true
          }));

        case 3:
          updated = _context2.sent;
          res.json({
            message: "Faculty account updated",
            updated: updated
          });
          _context2.next = 10;
          break;

        case 7:
          _context2.prev = 7;
          _context2.t0 = _context2["catch"](0);
          res.status(400).json({
            message: _context2.t0.message
          });

        case 10:
        case "end":
          return _context2.stop();
      }
    }
  }, null, null, [[0, 7]]);
}); // Remove faculty account

router["delete"]("/faculty/:id", function _callee3(req, res) {
  return regeneratorRuntime.async(function _callee3$(_context3) {
    while (1) {
      switch (_context3.prev = _context3.next) {
        case 0:
          _context3.prev = 0;
          _context3.next = 3;
          return regeneratorRuntime.awrap(_User["default"].findByIdAndDelete(req.params.id));

        case 3:
          res.json({
            message: "Faculty account removed"
          });
          _context3.next = 9;
          break;

        case 6:
          _context3.prev = 6;
          _context3.t0 = _context3["catch"](0);
          res.status(400).json({
            message: _context3.t0.message
          });

        case 9:
        case "end":
          return _context3.stop();
      }
    }
  }, null, null, [[0, 6]]);
}); // -------------------- VIEW RESEARCH RECORDS --------------------

router.get("/analytics", function _callee4(req, res) {
  var total, approved, pending, rejected, archived;
  return regeneratorRuntime.async(function _callee4$(_context4) {
    while (1) {
      switch (_context4.prev = _context4.next) {
        case 0:
          _context4.next = 2;
          return regeneratorRuntime.awrap(_Research["default"].countDocuments());

        case 2:
          total = _context4.sent;
          _context4.next = 5;
          return regeneratorRuntime.awrap(_Research["default"].countDocuments({
            status: "approved"
          }));

        case 5:
          approved = _context4.sent;
          _context4.next = 8;
          return regeneratorRuntime.awrap(_Research["default"].countDocuments({
            status: "pending"
          }));

        case 8:
          pending = _context4.sent;
          _context4.next = 11;
          return regeneratorRuntime.awrap(_Research["default"].countDocuments({
            status: "rejected"
          }));

        case 11:
          rejected = _context4.sent;
          _context4.next = 14;
          return regeneratorRuntime.awrap(_Research["default"].countDocuments({
            status: "archived"
          }));

        case 14:
          archived = _context4.sent;
          res.json({
            total: total,
            approved: approved,
            pending: pending,
            rejected: rejected,
            archived: archived
          });

        case 16:
        case "end":
          return _context4.stop();
      }
    }
  });
}); // View all research with details

router.get("/research", function _callee5(req, res) {
  var research;
  return regeneratorRuntime.async(function _callee5$(_context5) {
    while (1) {
      switch (_context5.prev = _context5.next) {
        case 0:
          _context5.next = 2;
          return regeneratorRuntime.awrap(_Research["default"].find().populate("student").populate("adviser").populate("panel"));

        case 2:
          research = _context5.sent;
          res.json(research);

        case 4:
        case "end":
          return _context5.stop();
      }
    }
  });
}); // -------------------- ARCHIVE PROJECTS --------------------

router.put("/archive/:id", function _callee6(req, res) {
  var research;
  return regeneratorRuntime.async(function _callee6$(_context6) {
    while (1) {
      switch (_context6.prev = _context6.next) {
        case 0:
          _context6.next = 2;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(req.params.id, {
            status: "archived"
          }, {
            "new": true
          }));

        case 2:
          research = _context6.sent;
          res.json({
            message: "Research archived",
            research: research
          });

        case 4:
        case "end":
          return _context6.stop();
      }
    }
  });
}); // -------------------- MONITORING & EVALUATION --------------------

router.get("/monitoring", function _callee7(req, res) {
  var reports;
  return regeneratorRuntime.async(function _callee7$(_context7) {
    while (1) {
      switch (_context7.prev = _context7.next) {
        case 0:
          _context7.prev = 0;
          _context7.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].find().populate("student adviser panel"));

        case 3:
          reports = _context7.sent;
          res.json(reports);
          _context7.next = 10;
          break;

        case 7:
          _context7.prev = 7;
          _context7.t0 = _context7["catch"](0);
          res.status(500).json({
            message: "Error fetching monitoring data"
          });

        case 10:
        case "end":
          return _context7.stop();
      }
    }
  }, null, null, [[0, 7]]);
}); // -------------------- APPROVE & ASSIGN PANELS --------------------

router.put("/approve/:id", function _callee8(req, res) {
  var research;
  return regeneratorRuntime.async(function _callee8$(_context8) {
    while (1) {
      switch (_context8.prev = _context8.next) {
        case 0:
          _context8.prev = 0;
          _context8.next = 3;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(req.params.id, {
            status: "approved"
          }, {
            "new": true
          }));

        case 3:
          research = _context8.sent;
          res.json({
            message: "Research approved",
            research: research
          });
          _context8.next = 10;
          break;

        case 7:
          _context8.prev = 7;
          _context8.t0 = _context8["catch"](0);
          res.status(400).json({
            message: _context8.t0.message
          });

        case 10:
        case "end":
          return _context8.stop();
      }
    }
  }, null, null, [[0, 7]]);
});
router.put("/assign-panel/:id", function _callee9(req, res) {
  var panelIds, research;
  return regeneratorRuntime.async(function _callee9$(_context9) {
    while (1) {
      switch (_context9.prev = _context9.next) {
        case 0:
          panelIds = req.body.panelIds; // array of faculty IDs

          _context9.prev = 1;
          _context9.next = 4;
          return regeneratorRuntime.awrap(_Research["default"].findByIdAndUpdate(req.params.id, {
            panel: panelIds
          }, {
            "new": true
          }).populate("panel"));

        case 4:
          research = _context9.sent;
          res.json({
            message: "Panel assigned",
            research: research
          });
          _context9.next = 11;
          break;

        case 8:
          _context9.prev = 8;
          _context9.t0 = _context9["catch"](1);
          res.status(400).json({
            message: _context9.t0.message
          });

        case 11:
        case "end":
          return _context9.stop();
      }
    }
  }, null, null, [[1, 8]]);
}); // -------------------- UPLOAD DOCUMENTS --------------------
// Assume file upload handled by multer

router.post("/upload", upload.single("file"), function _callee10(req, res) {
  return regeneratorRuntime.async(function _callee10$(_context10) {
    while (1) {
      switch (_context10.prev = _context10.next) {
        case 0:
          res.json({
            message: "Document uploaded successfully",
            file: req.file
          });

        case 1:
        case "end":
          return _context10.stop();
      }
    }
  });
}); // -------------------- SETTINGS --------------------

router.post("/settings", function _callee11(req, res) {
  var _req$body2, name, value, setting;

  return regeneratorRuntime.async(function _callee11$(_context11) {
    while (1) {
      switch (_context11.prev = _context11.next) {
        case 0:
          _req$body2 = req.body, name = _req$body2.name, value = _req$body2.value;
          _context11.next = 3;
          return regeneratorRuntime.awrap(SystemSetting.findOneAndUpdate({
            name: name
          }, {
            value: value
          }, {
            upsert: true,
            "new": true
          }));

        case 3:
          setting = _context11.sent;
          res.json(setting);

        case 5:
        case "end":
          return _context11.stop();
      }
    }
  });
});
router.get("/settings", function _callee12(req, res) {
  var settings;
  return regeneratorRuntime.async(function _callee12$(_context12) {
    while (1) {
      switch (_context12.prev = _context12.next) {
        case 0:
          _context12.next = 2;
          return regeneratorRuntime.awrap(SystemSetting.find());

        case 2:
          settings = _context12.sent;
          res.json(settings);

        case 4:
        case "end":
          return _context12.stop();
      }
    }
  });
}); // -------------------- LOGOUT --------------------

router.post("/logout", function (req, res) {
  // Just instruct client to clear token
  res.json({
    message: "Logged out successfully"
  });
}); // -------------------- INVITE FACULTY (via email) --------------------

router.post("/invite", function _callee13(req, res) {
  var _req$body3, email, name, newUser;

  return regeneratorRuntime.async(function _callee13$(_context13) {
    while (1) {
      switch (_context13.prev = _context13.next) {
        case 0:
          _req$body3 = req.body, email = _req$body3.email, name = _req$body3.name;
          _context13.prev = 1;
          newUser = new _User["default"]({
            name: name,
            email: email,
            role: "Faculty Adviser",
            password: Math.random().toString(36).slice(-8) // temp password

          });
          _context13.next = 5;
          return regeneratorRuntime.awrap(newUser.save());

        case 5:
          _context13.next = 7;
          return regeneratorRuntime.awrap(transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Faculty Invitation",
            text: "Hello ".concat(name, ",\n\nYou have been invited as a Faculty Adviser.\nTemporary password: ").concat(newUser.password, "\n\nPlease log in and change your password.")
          }));

        case 7:
          res.json({
            message: "Instructor invited via email",
            user: newUser
          });
          _context13.next = 13;
          break;

        case 10:
          _context13.prev = 10;
          _context13.t0 = _context13["catch"](1);
          res.status(400).json({
            message: _context13.t0.message
          });

        case 13:
        case "end":
          return _context13.stop();
      }
    }
  }, null, null, [[1, 10]]);
}); // Add error handling for email operations

router.post("/send-email", function _callee14(req, res) {
  var _req$body4, to, subject, text;

  return regeneratorRuntime.async(function _callee14$(_context14) {
    while (1) {
      switch (_context14.prev = _context14.next) {
        case 0:
          _context14.prev = 0;
          _req$body4 = req.body, to = _req$body4.to, subject = _req$body4.subject, text = _req$body4.text;
          _context14.next = 4;
          return regeneratorRuntime.awrap(transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: to,
            subject: subject,
            text: text
          }));

        case 4:
          res.json({
            message: "Email sent successfully"
          });
          _context14.next = 11;
          break;

        case 7:
          _context14.prev = 7;
          _context14.t0 = _context14["catch"](0);
          console.error("Email error:", _context14.t0);
          res.status(500).json({
            message: "Failed to send email"
          });

        case 11:
        case "end":
          return _context14.stop();
      }
    }
  }, null, null, [[0, 7]]);
});
var _default = router;
exports["default"] = _default;