const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Регистрация
router.post('/register', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        
        if (!email || !username || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }
        
        // Проверка существующего пользователя
        const existingUser = await query(
            'SELECT id FROM users WHERE email = $1 OR username = $2',
            [email.toLowerCase(), username.toLowerCase()]
        );
        
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        const result = await query(
            `INSERT INTO users (email, username, password_hash) 
             VALUES ($1, $2, $3) RETURNING id, email, username, avatar_url, created_at`,
            [email.toLowerCase(), username.toLowerCase(), passwordHash]
        );
        
        const user = result.rows[0];
        
        const token = jwt.sign(
            { userId: user.id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({ 
            success: true,
            token, 
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                avatar_url: user.avatar_url,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Логин
router.post('/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        
        if (!login || !password) {
            return res.status(400).json({ error: 'Login and password are required' });
        }
        
        const result = await query(
            'SELECT * FROM users WHERE email = $1 OR username = $1',
            [login.toLowerCase()]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const user = result.rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign(
            { userId: user.id, email: user.email, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );
        
        res.json({ 
            success: true,
            token, 
            user: { 
                id: user.id, 
                email: user.email, 
                username: user.username,
                avatar_url: user.avatar_url,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Получение текущего пользователя
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, email, username, avatar_url, created_at 
             FROM users WHERE id = $1`,
            [req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get me error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;