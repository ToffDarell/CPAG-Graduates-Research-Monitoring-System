import User from "../models/User.js";
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import { ExecutableResponseError } from "google-auth-library/build/src/auth/executable-response.js";

dotenv.config();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

export const protect = async (req, res, next) =>{
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
      try {
        token = req.headers.authorization.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = await User.findById(decoded.id).select("-password");

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

    //Instituional email check
    if (!user.email.endsWith("@buksu.edu.ph") && !user.email.endsWith("@student.buksu.edu.ph")) {
      return res.status(403).json({ message: "Institutional email required" });
    }

    //Role Check
    if (roles.length && !roles.includes(user.role)){
          console.log(`Access denied: User role "${user.role}" not in allowed roles:`, roles);
          return res.status(403).json({ message: `Access denied. User role: ${user.role}, Required: ${roles.join(', ')}` });
    }
    next();

  }
}

export const authorize = (roles = []) => {
  return checkAuth(roles); // Reuse existing checkAuth function
};