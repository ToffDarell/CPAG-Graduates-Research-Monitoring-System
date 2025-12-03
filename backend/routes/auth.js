import express from 'express';
import { protect } from '../middleware/auth.js';
import {
    verifyInvitation,
    completeRegistration,
    register,
    login,
    forgotPassword,
    resetPassword,
    getMe,
    getPermissions,
    updateProfile,
    requestChangePasswordCode,
    changePassword,
    googleAuth
} from '../controllers/authController.js';

const router = express.Router();

// ========== Verify Invitation Token ==========
router.get('/verify-invitation/:token', verifyInvitation);

// ========== Complete Registration (with invitation token) ==========
router.post('/complete-registration', completeRegistration);

// ========== Register ==========
router.post('/register', register);

// ========== Login ==========
router.post('/login', login);

// ========== Forgot Password ==========
router.post('/forgot-password', forgotPassword);

// ========== Reset Password ==========
router.post('/reset-password/:token', resetPassword);

// ========== Me ==========
router.get('/me', protect, getMe);

// ========== Get User Permissions ==========
router.get('/me/permissions', protect, getPermissions);

// ========== Update Profile ==========
router.put('/profile', protect, updateProfile);

// ========== Request Change Password Code ==========
router.post('/request-change-password-code', protect, requestChangePasswordCode);

// ========== Change Password ==========
router.put('/change-password', protect, changePassword);

// ========== Google OAuth ==========
router.post('/google', googleAuth);

export default router;
