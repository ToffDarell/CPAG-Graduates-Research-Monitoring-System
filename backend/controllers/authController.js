import User from '../models/User.js';
import Role from '../models/Role.js';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

dotenv.config();
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);

// ========== Helper Functions ==========
export const verifyRecaptchaToken = async (recaptchaToken, remoteIp) => {
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
};

export const generateToken = (id) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured in environment variables');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ========== Verify Invitation Token ==========
export const verifyInvitation = async (req, res) => {
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
};

// ========== Complete Registration (with invitation token) ==========
export const completeRegistration = async (req, res) => {
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
};

// ========== Register ==========
export const register = async (req, res) => {
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

        // Restrict direct registration to only students
        const allowedRoles = ['graduate student'];
        if (!allowedRoles.includes(role)) {
            return res.status(403).json({ 
                message: 'Direct registration is only allowed for Students. Deans, Faculty Advisers, and Program Heads must register through invitation links sent by the Administrator or Dean.' 
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
                    message: 'Please activate your account by completing the password setup. Contact your Dean or the System Administrator for assistance.' 
                });
            }
            return res.status(400).json({ message: 'Account is not active. Please contact your Dean or the System Administrator for assistance.' });
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
};

// ========== Login ==========
export const login = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // reCAPTCHA check - only verify if secret key is configured
        const recaptchaSecretKey = process.env.RECAPTCHA_SECRET_KEY;
        if (recaptchaSecretKey) {
            const isHuman = await verifyRecaptchaToken(req.body.recaptcha, req.ip);
            if (!isHuman) {
                return res.status(400).json({ message: 'Recaptcha verification failed. Please complete the reCAPTCHA verification.' });
            }
        }
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
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // Check if account is active
        if (!user.isActive) {
            return res.status(401).json({ 
                message: 'Account is not active. Please activate your account by completing the password setup. Contact the Dean for assistance.' 
            });
        }

        // Check if user has a password set
        if (!user.password) {
            return res.status(401).json({ 
                message: 'Account not fully set up. Please complete your registration.' 
            });
        }

        // Check if password matches
        if (!(await user.matchPassword(password))) {
            return res.status(401).json({ message: 'Invalid email or password' });
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
        console.error('Login error:', err);
        console.error('Error stack:', err.stack);
        res.status(500).json({ 
            message: 'Login failed', 
            error: process.env.NODE_ENV === 'development' ? err.message : undefined 
        });
    }
};

// ========== Forgot Password ==========
export const forgotPassword = async (req, res) => {
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
            subject: 'Password Reset Request',
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
};

// ========== Reset Password ==========
export const resetPassword = async (req, res) => {
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
};

// ========== Me ==========
export const getMe = async (req, res) => {
    try {
        // Fetch fresh user data from database to ensure we have latest info
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            id: user._id.toString(),
            name: user.name || '',
            email: user.email || '',
            role: user.role || '',
            version: user.version || 0,
        });
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Failed to fetch user data' });
    }
};

// ========== Get User Permissions ==========
export const getPermissions = async (req, res) => {
    try {
        // Admin has all permissions
        if (req.user.role === 'admin') {
            return res.status(200).json({
                role: 'admin',
                permissions: [],
                hasAllPermissions: true,
            });
        }

        // Get user's role with permissions
        const userRole = await Role.findOne({
            name: req.user.role.toLowerCase(),
            isActive: true,
        }).populate('permissions');

        if (!userRole || !userRole.permissions) {
            return res.status(200).json({
                role: req.user.role,
                permissions: [],
                hasAllPermissions: false,
            });
        }

        // Return permission names
        const permissionNames = userRole.permissions
            .filter((p) => p.isActive)
            .map((p) => p.name);

        res.status(200).json({
            role: req.user.role,
            permissions: permissionNames,
            hasAllPermissions: false,
        });
    } catch (error) {
        console.error('Error fetching user permissions:', error);
        res.status(500).json({ message: 'Failed to fetch user permissions' });
    }
};

// ========== Update Profile ==========
export const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { name, email, version } = req.body;

        // MVCC: Check version for optimistic locking
        if (version === undefined || version === null) {
            return res.status(400).json({ 
                message: 'Version field is required. Please reload the page and try again.' 
            });
        }

        const currentVersion = user.version || 0;
        if (version !== currentVersion) {
            return res.status(409).json({ 
                message: 'This profile was updated by another user. Please reload the page to see the latest changes and try again.' 
            });
        }

        // Debug logging
        console.log('Profile update request:', {
            userId: user._id.toString(),
            currentEmail: user.email,
            currentRole: user.role,
            receivedName: name,
            receivedEmail: email,
            submittedVersion: version,
            currentVersion: currentVersion
        });

        // Build update object with only the fields we're changing
        const updateData = {};
        let normalizedEmail = null;
        let emailChanged = false;

        // Validate and prepare name update
        if (name !== undefined) {
            const trimmedName = name.trim();
            if (!trimmedName || trimmedName.length === 0) {
                return res.status(400).json({ message: 'Name cannot be empty.' });
            }
            updateData.name = trimmedName;
        }

        // Validate and prepare email update
        if (email !== undefined) {
            normalizedEmail = email.toLowerCase().trim();
            
            if (!normalizedEmail || normalizedEmail.length === 0) {
                return res.status(400).json({ message: 'Email cannot be empty.' });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(normalizedEmail)) {
                return res.status(400).json({ message: 'Invalid email format.' });
            }

            // Role-based email domain validation
            const emailDomain = normalizedEmail.split('@')[1];
            const isStudent = user.role === 'graduate student';
            
            console.log('Email validation:', {
                emailDomain,
                isStudent,
                userRole: user.role,
                normalizedEmail
            });
            
            if (isStudent && emailDomain !== 'student.buksu.edu.ph') {
                return res.status(400).json({ 
                    message: 'Graduate students must use @student.buksu.edu.ph email address.' 
                });
            }
            
            if (!isStudent && emailDomain !== 'buksu.edu.ph') {
                return res.status(400).json({ 
                    message: 'Faculty, Dean, and Program Head must use @buksu.edu.ph email address.' 
                });
            }

            // Normalize current user email for comparison
            const currentEmailNormalized = (user.email || '').toLowerCase().trim();
            
            // Only update if email is actually changing
            if (normalizedEmail !== currentEmailNormalized) {
                // Check for duplicates
                const existingUser = await User.findOne({ email: normalizedEmail });
                if (existingUser && existingUser._id.toString() !== user._id.toString()) {
                    return res.status(400).json({ message: 'Email is already in use by another account.' });
                }
                updateData.email = normalizedEmail;
                emailChanged = true;
            } else {
                // Email is the same, no need to update
                console.log('Email unchanged, skipping update');
            }
        }

        // MVCC: Increment version and add to update data
        updateData.version = currentVersion + 1;

        // Use findByIdAndUpdate to update only specified fields
        // This avoids validation errors on fields we're not updating (like studentId)
        // We still validate the fields we ARE updating through our manual validation above
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            updateData,
            { 
                new: true, // Return updated document
                runValidators: false // Skip validators since we've already validated manually
            }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found after update.' });
        }

        // Return updated user data with new version
        const sanitizedUser = {
            id: updatedUser._id.toString(),
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            version: updatedUser.version || 0,
        };

        res.json({
            message: 'Profile updated successfully.',
            user: sanitizedUser,
        });
    } catch (error) {
        console.error('Profile update error:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            errors: error.errors
        });
        
        // Handle validation errors from Mongoose
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({ 
                message: 'Validation error',
                errors: errors 
            });
        }
        
        // Handle duplicate key errors (e.g., email already exists)
        if (error.code === 11000) {
            return res.status(400).json({ 
                message: 'Email is already in use by another account.' 
            });
        }
        
        res.status(500).json({ 
            message: error.message || 'Failed to update profile.' 
        });
    }
};

// ========== Request Change Password Code ==========
export const requestChangePasswordCode = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.email) {
            return res.status(400).json({ message: 'Email address not found.' });
        }

        // Generate 6-digit code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

        // Save hashed code and expiry (15 minutes)
        user.changePasswordCode = hashedCode;
        user.changePasswordCodeExpires = Date.now() + 900000; // 15 minutes
        await user.save();

        // Send email with code
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: user.email,
            subject: 'Password Change Verification Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #7C1D23;">Password Change Verification</h2>
                    <p>Hello <strong>${user.name}</strong>,</p>
                    <p>You requested to change your password. Use the verification code below:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <div style="background-color: #f5f5f5; border: 2px dashed #7C1D23; padding: 20px; border-radius: 5px; display: inline-block;">
                            <p style="font-size: 32px; font-weight: bold; color: #7C1D23; letter-spacing: 5px; margin: 0;">${code}</p>
                        </div>
                    </div>
                    <p style="color: #666; font-size: 14px;">This code will expire in 15 minutes.</p>
                    <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email and ensure your account is secure.</p>
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;" />
                    <p style="color: #999; font-size: 12px;">This is an automated message. Please do not reply.</p>
                </div>
            `,
        });

        res.status(200).json({ 
            message: 'Verification code sent to your email. Please check your inbox.' 
        });
    } catch (error) {
        console.error('Request change password code error:', error);
        res.status(500).json({ message: 'Failed to send verification code.' });
    }
};

// ========== Change Password ==========
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword, resetCode } = req.body;

    if (!currentPassword || !newPassword || !resetCode) {
        return res.status(400).json({ message: 'Current password, new password, and verification code are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ message: 'New password must be at least 6 characters.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (!user.password) {
            return res.status(400).json({ message: 'Password updates are not available for this account.' });
        }

        // Verify current password
        const isMatch = await user.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ message: 'Current password is incorrect.' });
        }

        // Verify reset code
        if (!user.changePasswordCode || !user.changePasswordCodeExpires) {
            return res.status(400).json({ message: 'Please request a verification code first.' });
        }

        if (user.changePasswordCodeExpires < Date.now()) {
            return res.status(400).json({ message: 'Verification code has expired. Please request a new one.' });
        }

        const hashedCode = crypto.createHash('sha256').update(resetCode).digest('hex');
        if (user.changePasswordCode !== hashedCode) {
            return res.status(400).json({ message: 'Invalid verification code.' });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ message: 'New password must be different from the current password.' });
        }

        // Update password and clear code
        user.password = newPassword;
        user.changePasswordCode = undefined;
        user.changePasswordCodeExpires = undefined;
        await user.save();

        res.json({ message: 'Password updated successfully.' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Failed to update password.' });
    }
};

// ========== Google OAuth ==========
export const googleAuth = async (req, res) => {
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
};

