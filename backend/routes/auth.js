import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { protect } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

const router = express.Router();

// ========== reCAPTCHA verification ==========
async function verifyRecaptchaToken(recaptchaToken, remoteIp) {
    try {
        if (!recaptchaToken) return false;

        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (!secretKey) return false;

        const params = new URLSearchParams();
        params.append('secret', secretKey);
        params.append('response', recaptchaToken);
        if (remoteIp) params.append('remoteip', remoteIp);

        const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await response.json();
        return !!(data && data.success === true);
    } catch (err) {
        console.error('reCAPTCHA verification error:', err);
        return false;
    }
}

// ========== Verify Invitation Token ==========
router.get('/verify-invitation/:token', async (req, res) => {
    try {
        const user = await User.findOne({
            invitationToken: req.params.token,
            invitationExpires: { $gt: Date.now() }
        }).select('-password');

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired invitation token' });
        }

        res.json({ 
            valid: true, 
            user: { 
                name: user.name, 
                email: user.email, 
                role: user.role 
            } 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error verifying invitation token' });
    }
});

// ========== Complete Registration (with invitation token) ==========
router.post('/complete-registration', async (req, res) => {
    const { token, password, recaptcha } = req.body;

    try {
        // reCAPTCHA check
        const isHuman = await verifyRecaptchaToken(recaptcha, req.ip);
        if (!isHuman) {
            return res.status(400).json({ message: 'Recaptcha verification failed' });
        }

        // Find user with valid invitation token
        const user = await User.findOne({
            invitationToken: token,
            invitationExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired invitation token' });
        }

        // Set password and activate account
        user.password = password;
        user.isActive = true;
        user.invitationToken = undefined;
        user.invitationExpires = undefined;
        await user.save();

        // Generate JWT token
        const jwtToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        res.json({
            message: 'Registration completed successfully',
            token: jwtToken,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Registration completion error:', error);
        res.status(500).json({ message: error.message || 'Error completing registration' });
    }
});

// ========== Register ==========
router.post('/register', async (req, res) => {
    const { name, email, password, role, studentId } = req.body;

    // reCAPTCHA check
    const isHuman = await verifyRecaptchaToken(req.body.recaptcha, req.ip);
    if (!isHuman) {
        return res.status(400).json({ message: 'Recaptcha verification failed' });
    }

    try {
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields (name, email, password, role) are required' });
        }


           // Restrict direct registration to only students and deans
           const allowedRoles = ['graduate student', 'dean'];
           if (!allowedRoles.includes(role)) {
               return res.status(403).json({ 
                   message: 'Direct registration is only allowed for Students and Deans. Faculty and Program Heads must register through invitation links sent by the Dean.' 
               });
           }
   

        // institutional email check
        if (!email.endsWith('@buksu.edu.ph') && !email.endsWith('@student.buksu.edu.ph')) {
            return res.status(400).json({ message: 'Institutional emails only' });
        }

        // Check if email exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            if (!existingUser.isActive) {
                return res.status(401).json({ 
                    message: 'Please activate your account by completing the setting up the password. Contact the Dean for assistance.' 
                });
            }
            return res.status(400).json({ message: 'Account is not active. Please contact the Dean for assistance.' });
        } 

        // Validate email domain based on role
        const emailDomain = email.split('@')[1];
        const isStudent = role === 'graduate student';
        
        if (isStudent && emailDomain !== 'student.buksu.edu.ph') {
            return res.status(400).json({ message: 'Graduate students must use @student.buksu.edu.ph email' });
        }
        
        if (!isStudent && emailDomain !== 'buksu.edu.ph') {
            return res.status(400).json({ message: 'Faculty/Dean must use @buksu.edu.ph email' });
        }

        // Create user object based on role
        const userData = {
            name,
            email,
            password,
            role,
            ...(role === "graduate student" 
                ? { 
                    studentId: studentId,
                    isActive: true  // Students are automatically active
                }
                : {
                    isActive: true  // Deans are automatically active
                }
            )
        };

        const user = await User.create(userData);
        const token = generateToken(user.id);

        res.status(201).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Registration failed' });
    }
});

// ========== Login ==========
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;

    // reCAPTCHA check
    const isHuman = await verifyRecaptchaToken(req.body.recaptcha, req.ip);
    if (!isHuman) {
        return res.status(400).json({ message: 'Recaptcha verification failed' });
    }

    try {
        if (!email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // institutional email check
        if (!email.endsWith('@buksu.edu.ph') && !email.endsWith('@student.buksu.edu.ph')) {
            return res.status(400).json({ message: 'Institutional emails only' });
        }

        const user = await User.findOne({ email });

     // Check if user exists
if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
}

// Check if account is active
if (!user.isActive) {
    return res.status(401).json({ 
        message: 'Please activate your account by completing the setting up the password. Contact the Dean for assistance.' 
    });
}

// Check if password matches
if (!(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
}


        const token = generateToken(user.id);
        res.status(200).json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            token,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Login failed' });
    }
});

// ========== Forgot Password ==========
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Check if institutional email
        if (!email.endsWith('@buksu.edu.ph') && !email.endsWith('@student.buksu.edu.ph')) {
            return res.status(400).json({ message: 'Institutional emails only' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            // For security, don't reveal if email exists
            return res.status(200).json({ 
                message: 'If your email is registered, you will receive a password reset link.' 
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Save hashed token and expiry (1 hour)
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Create reset URL
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

        // Send email
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: user.email,
            subject: 'Password Reset Request - Masteral Archive System',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #7C1D23;">Password Reset Request</h2>
                    <p>Hello <strong>${user.name}</strong>,</p>
                    <p>You requested to reset your password. Click the button below to reset it:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" 
                           style="background-color: #7C1D23; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                            Reset Password
                        </a>
                    </div>
                    <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
                    <p style="color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link:</p>
                    <p style="color: #7C1D23; font-size: 12px; word-break: break-all;">${resetUrl}</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                    <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
                </div>
            `,
        });

        res.status(200).json({ 
            message: 'If your email is registered, you will receive a password reset link.' 
        });
    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({ message: 'Failed to process password reset request' });
    }
});

// ========== Reset Password ==========
router.post('/reset-password/:token', async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }

        // Hash the token from URL to compare with stored hash
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid token
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }, // Token not expired
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired reset token' });
        }

        // Update password (will be hashed by pre-save hook)
        user.password = password;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: 'Password reset successful! You can now log in.' });
    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({ message: 'Failed to reset password' });
    }
});

// ========== Me ==========
router.get('/me', protect, async (req, res) => {
    res.status(200).json({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
    });
});

// ========== Google OAuth ==========
router.post('/google', async (req, res) => {
    try {
        const { credential, selectedRole, studentId } = req.body;  
        if (!credential) {
            return res.status(400).json({ message: 'Missing Google credential' });
        }

        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const name = payload.name || email.split('@')[0];

        // Email domain validation
        const isStudentEmail = email.endsWith('@student.buksu.edu.ph');
        const isFacultyEmail = email.endsWith('@buksu.edu.ph');

        if (!isStudentEmail && !isFacultyEmail) {
            return res.status(400).json({ message: 'Institutional emails only' });
        }

        // Rest of the authentication process
        let user = await User.findOne({ email });

        if (user) {
            const token = generateToken(user.id);
            return res.status(200).json({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                token,
            });
        } 

         // Require selectedRole for new signups
         if (!selectedRole) {
            return res.status(400).json({ 
                message: 'Account not found. Please sign up by selecting a role first.' 
            });
        }

        // Validate email domain matches selected role for new registrations
        if (isStudentEmail && !selectedRole.includes('student')) {
            return res.status(400).json({ 
                message: 'Student emails can only be used for graduate student accounts' 
            });
        }

        if (isFacultyEmail && selectedRole.includes('student')) {
            return res.status(400).json({ 
                message: 'Faculty/Dean emails cannot be used for student accounts' 
            });
        }

          // Create new user with selected role
          const role = isStudentEmail ? 'graduate student' : selectedRole;
          
        
          
          const userData = { 
              name,
              email,
              password: `google-oauth-${Date.now()}`,
              role,
              isActive: true,
              
          };
            // Validate studentId is required for graduate students
            if (role === 'graduate student') {
                userData.studentId = studentId;
            }

          user = await User.create(userData);
  
          const token = generateToken(user.id);
          return res.status(200).json({
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role,
              token,
          });
        } catch (err) {
            console.error('Google auth error:', err);
            return res.status(401).json({ 
                message: 'Google authentication failed', 
                error: err.message 
            });
        }
    }); 

// ========== JWT Token Generator ==========
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

export default router;
