"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.authorizeRole = void 0;

// middleware/authorize.js
var authorizeRole = function authorizeRole(roles) {
  return function (req, res, next) {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Access denied"
      });
    }

    next();
  };
};

exports.authorizeRole = authorizeRole;