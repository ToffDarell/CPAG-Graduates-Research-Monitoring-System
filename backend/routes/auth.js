import express from 'express';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { protect } from '../middleware/auth.js';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

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

        // institutional email check
        if (!email.endsWith('@buksu.edu.ph') && !email.endsWith('@student.buksu.edu.ph')) {
            return res.status(400).json({ message: 'Institutional emails only' });
        }

        // Check if email exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Validate email domain based on role
        const emailDomain = email.split('@')[1];
        const isStudent = role === 'graduate student';
        
        if (isStudent && emailDomain !== 'student.buksu.edu.ph') {
            return res.status(400).json({ message: 'Graduate students must use @student.buksu.edu.ph email' });
        }
        
        if (!isStudent && emailDomain !== 'buksu.edu.ph') {
            return res.status(400).json({ message: 'Faculty/Admin must use @buksu.edu.ph email' });
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
                : role === "admin/dean"
                ? {
                    isActive: true // Admin/Dean are automatically active
                }
                :{}

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
            return res.status(401).json({ message: 'Account is not active. Please complete your registration.' });
        }

        // Check if password matches
        if (!(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check if trying to login with different role than registered
        if (user.role !== role) {
            return res.status(403).json({ 
                message: `This email is registered as ${user.role}. Please select the correct role.`
            });
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
        const { credential, selectedRole } = req.body;  // Add selectedRole from frontend
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

        // Prevent faculty emails for student accounts and vice versa
        if (isStudentEmail && !selectedRole.includes('student')) {
            return res.status(400).json({ message: 'Student emails can only be used for graduate student accounts' });
        }

        if (isFacultyEmail && selectedRole.includes('student')) {
            return res.status(400).json({ message: 'Faculty/Admin emails cannot be used for student accounts' });
        }

        // Set role based on email domain and selection
        const role = isStudentEmail ? 'graduate student' : selectedRole;

        // Rest of the authentication process
        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({
                name,
                email,
                password: `google-oauth-${Date.now()}`,
                role
            });
        }

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
        return res.status(401).json({ message: 'Google authentication failed', error: err.message });
    }
});

// ========== JWT Token Generator ==========
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

export default router;
