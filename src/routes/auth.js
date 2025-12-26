/**
 * Authentication Routes
 * Secure email-based login with verification codes
 * 
 * Flow:
 * 1. POST /api/auth/request-code - Send 6-digit code to email
 * 2. POST /api/auth/verify-code - Verify code, return JWT
 * 3. GET /api/auth/me - Get current user from JWT
 * 4. POST /api/auth/logout - Clear session
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

const router = express.Router();

// JWT Secret - use env var or generate one
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRES_IN = '7d';

// In-memory store for pending codes (production: use Redis)
const pendingCodes = new Map();
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ATTEMPTS = 3;

// Rate limiting (simple in-memory)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 3;

// Email transporter (lazy init)
let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASSWORD;

    if (!emailUser || !emailPass) {
        console.warn('[Auth] Email not configured - codes will be logged to console');
        return null;
    }

    transporter = nodemailer.createTransport({
        host: process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_SMTP_PORT || '465'),
        secure: true,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });

    return transporter;
}

function generateCode() {
    return crypto.randomInt(100000, 999999).toString();
}

function isRateLimited(email) {
    const now = Date.now();
    const key = email.toLowerCase();
    const entry = rateLimit.get(key);

    if (!entry || now - entry.timestamp > RATE_LIMIT_WINDOW) {
        rateLimit.set(key, { count: 1, timestamp: now });
        return false;
    }

    if (entry.count >= MAX_REQUESTS) {
        return true;
    }

    entry.count++;
    return false;
}

function cleanupExpiredCodes() {
    const now = Date.now();
    for (const [email, data] of pendingCodes) {
        if (now - data.createdAt > CODE_EXPIRY_MS) {
            pendingCodes.delete(email);
        }
    }
}

// Cleanup every 5 minutes
setInterval(cleanupExpiredCodes, 5 * 60 * 1000);

/**
 * POST /api/auth/request-code
 * Body: { email }
 * Response: { success: true, message: "Code sent" }
 */
router.post('/request-code', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email || typeof email !== 'string') {
            return res.status(400).json({ error: 'Email is required' });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        // Rate limiting
        if (isRateLimited(normalizedEmail)) {
            return res.status(429).json({
                error: 'Too many requests. Please wait a minute before trying again.'
            });
        }

        // Generate code
        const code = generateCode();

        // Store pending code
        pendingCodes.set(normalizedEmail, {
            code,
            attempts: 0,
            createdAt: Date.now()
        });

        // Try to send email
        const transport = getTransporter();

        if (transport) {
            try {
                await transport.sendMail({
                    from: process.env.EMAIL_FROM || 'DeepFish <noreply@deepfish.app>',
                    to: normalizedEmail,
                    subject: 'Your DeepFish Login Code',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #FF3366;">🐟 DeepFish</h2>
                            <p>Your login code is:</p>
                            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px; margin: 20px 0;">
                                ${code}
                            </div>
                            <p style="color: #666; font-size: 14px;">This code expires in 10 minutes.</p>
                            <p style="color: #666; font-size: 14px;">If you didn't request this, you can ignore this email.</p>
                        </div>
                    `
                });
                console.log(`[Auth] Verification code sent to ${normalizedEmail}`);
            } catch (emailErr) {
                console.error('[Auth] Failed to send email:', emailErr.message);
                // Fall through - still log code for testing
            }
        }

        // Always log code to console for development/debugging
        console.log(`[Auth] 🔐 Code for ${normalizedEmail}: ${code}`);

        res.json({ success: true, message: 'Verification code sent to your email' });

    } catch (err) {
        console.error('[Auth] Error in request-code:', err);
        res.status(500).json({ error: 'Failed to send verification code' });
    }
});

/**
 * POST /api/auth/verify-code
 * Body: { email, code }
 * Response: { success: true, token: "jwt...", user: {...} }
 */
router.post('/verify-code', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ error: 'Email and code are required' });
        }

        const normalizedEmail = email.toLowerCase().trim();
        const pending = pendingCodes.get(normalizedEmail);

        if (!pending) {
            return res.status(400).json({ error: 'No pending code. Please request a new one.' });
        }

        // Check expiry
        if (Date.now() - pending.createdAt > CODE_EXPIRY_MS) {
            pendingCodes.delete(normalizedEmail);
            return res.status(400).json({ error: 'Code expired. Please request a new one.' });
        }

        // Check attempts
        if (pending.attempts >= MAX_ATTEMPTS) {
            pendingCodes.delete(normalizedEmail);
            return res.status(400).json({ error: 'Too many attempts. Please request a new code.' });
        }

        // Verify code
        if (pending.code !== code.toString().trim()) {
            pending.attempts++;
            return res.status(400).json({
                error: 'Invalid code',
                attemptsRemaining: MAX_ATTEMPTS - pending.attempts
            });
        }

        // Success! Clear pending code
        pendingCodes.delete(normalizedEmail);

        // Create user data
        const user = {
            id: 'user_' + crypto.randomBytes(8).toString('hex'),
            email: normalizedEmail,
            tier: 'free',
            createdAt: new Date().toISOString()
        };

        // Generate JWT
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        console.log(`[Auth] ✅ User logged in: ${normalizedEmail}`);

        res.json({
            success: true,
            token,
            user
        });

    } catch (err) {
        console.error('[Auth] Error in verify-code:', err);
        res.status(500).json({ error: 'Failed to verify code' });
    }
});

/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 * Response: { user: {...} }
 */
router.get('/me', (req, res) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            res.json({
                user: {
                    id: decoded.userId,
                    email: decoded.email,
                    tier: 'free' // Could be fetched from DB
                }
            });
        } catch (tokenErr) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

    } catch (err) {
        console.error('[Auth] Error in /me:', err);
        res.status(500).json({ error: 'Failed to get user' });
    }
});

/**
 * POST /api/auth/logout
 * Just returns success - client clears token
 */
router.post('/logout', (req, res) => {
    res.json({ success: true });
});

export default router;
