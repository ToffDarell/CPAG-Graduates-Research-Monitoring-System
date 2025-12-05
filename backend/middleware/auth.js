import User from "../models/User.js";
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { ExecutableResponseError } from "google-auth-library/build/src/auth/executable-response.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

export const protect = async (req, res, next) =>{
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      try {
        token = req.headers.authorization.split(" ")[1];
        console.log("JWT_SECRET exists:", !!process.env.JWT_SECRET);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decoded.id).select("-password");
        console.log("User found:", req.user ? "User exists" : "User not found");
        console.log("User role:", req.user?.role);
        return next();
      } catch (error) {
        console.error("Token verification failed: ", error.message);
        return res.status(401).json({ message: "Not authorized, token failed" });
      }
        
    }
    return res.status(401).json({ message: "Not authorized, token failed" });
  }

  export const checkAuth = (roles = []) => {
    return (req, res, next) => {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      // Debug logging to see what's happening
      console.log("User role:", user.role);
      console.log("Allowed roles:", roles);

      // Role Check - simple case-insensitive comparison
      const userRole = user.role;
      
      // If no roles specified, allow access
      if (roles.length === 0) {
        return next();
      }

      // Check if user role matches any of the allowed roles (case-insensitive)
      const hasAccess = roles.some(allowedRole => 
        allowedRole.toLowerCase() === userRole.toLowerCase()
      );

      if (!hasAccess) {
        console.log(`Access denied: User role "${userRole}" not in allowed roles:`, roles);
        return res.status(403).json({ message: `Access denied. User role: ${userRole}, Required: ${roles.join(', ')}` });
      }
      
      next();
   }
 }

export const authorize = (roles = []) => {
  return checkAuth(roles); // Reuse existing checkAuth function
};