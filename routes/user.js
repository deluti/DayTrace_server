const express = require('express');
const { query } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// Настройка multer для загрузки аватаров
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/avatars');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `avatar-${req.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// Получение профиля пользователя
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, email, username, avatar_url, created_at 
             FROM users WHERE id = $1`,
            [req.userId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Получение статистики
        const statsResult = await query(
            `SELECT 
                COUNT(*) as total_rated,
                COALESCE(ROUND(AVG(rating), 1), 0) as avg_rating
             FROM days_ratings 
             WHERE user_id = $1`,
            [req.userId]
        );
        
        res.json({
            ...result.rows[0],
            stats: statsResult.rows[0]
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Обновление профиля
router.put('/profile', authMiddleware, async (req, res) => {
    try {
        const { username, email } = req.body;
        
        // Проверка уникальности username
        if (username) {
            const existingUser = await query(
                'SELECT id FROM users WHERE username = $1 AND id != $2',
                [username, req.userId]
            );
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }
        
        // Проверка уникальности email
        if (email) {
            const existingUser = await query(
                'SELECT id FROM users WHERE email = $1 AND id != $2',
                [email, req.userId]
            );
            if (existingUser.rows.length > 0) {
                return res.status(400).json({ error: 'Email already in use' });
            }
        }
        
        const result = await query(
            `UPDATE users 
             SET username = COALESCE($1, username),
                 email = COALESCE($2, email),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3
             RETURNING id, email, username, avatar_url, created_at`,
            [username, email, req.userId]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Загрузка аватара
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;
        
        const result = await query(
            `UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2
             RETURNING avatar_url`,
            [avatarUrl, req.userId]
        );
        
        res.json({ avatar_url: result.rows[0].avatar_url });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ error: 'Server error uploading avatar' });
    }
});

// Получение уведомлений
router.get('/notifications', authMiddleware, async (req, res) => {
    try {
        const result = await query(
            `SELECT id, type, message, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 50`,
            [req.userId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Отметить уведомление как прочитанное
router.put('/notifications/:id/read', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        await query(
            `UPDATE notifications 
             SET is_read = TRUE
             WHERE id = $1 AND user_id = $2`,
            [id, req.userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Получение списка друзей
router.get('/friends', authMiddleware, async (req, res) => {
    try {
        const result = await query(
            `SELECT 
                f.id,
                f.status,
                f.created_at,
                u.id as friend_id,
                u.username as friend_username,
                u.email as friend_email,
                u.avatar_url as friend_avatar
             FROM friends f
             JOIN users u ON (f.friend_id = u.id OR f.user_id = u.id)
             WHERE (f.user_id = $1 OR f.friend_id = $1)
               AND u.id != $1
             ORDER BY f.created_at DESC`,
            [req.userId]
        );
        
        res.json(result.rows);
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Отправить запрос в друзья
router.post('/friends', authMiddleware, async (req, res) => {
    try {
        const { username } = req.body;
        
        // Найти пользователя по username
        const friendResult = await query(
            'SELECT id FROM users WHERE username = $1',
            [username]
        );
        
        if (friendResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        const friendId = friendResult.rows[0].id;
        
        if (friendId === req.userId) {
            return res.status(400).json({ error: 'Cannot add yourself as friend' });
        }
        
        // Проверить, не уже ли друзья
        const existingFriend = await query(
            `SELECT id, status FROM friends 
             WHERE (user_id = $1 AND friend_id = $2) 
                OR (user_id = $2 AND friend_id = $1)`,
            [req.userId, friendId]
        );
        
        if (existingFriend.rows.length > 0) {
            if (existingFriend.rows[0].status === 'accepted') {
                return res.status(400).json({ error: 'Already friends' });
            }
            return res.status(400).json({ error: 'Friend request already sent' });
        }
        
        // Отправить запрос
        const result = await query(
            `INSERT INTO friends (user_id, friend_id, status)
             VALUES ($1, $2, 'pending')
             RETURNING id`,
            [req.userId, friendId]
        );
        
        // Создать уведомление
        const userResult = await query(
            'SELECT username FROM users WHERE id = $1',
            [req.userId]
        );
        
        await query(
            `INSERT INTO notifications (user_id, type, message)
             VALUES ($1, 'friend_request', $2)`,
            [friendId, `${userResult.rows[0].username} sent you a friend request`]
        );
        
        res.json({ success: true, friend_id: friendId });
    } catch (error) {
        console.error('Add friend error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Принять запрос в друзья
router.put('/friends/:id/accept', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        await query(
            `UPDATE friends 
             SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND friend_id = $2`,
            [id, req.userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Accept friend error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Отклонить запрос в друзья
router.put('/friends/:id/reject', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        
        await query(
            `DELETE FROM friends WHERE id = $1 AND friend_id = $2`,
            [id, req.userId]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Reject friend error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
// Получение оценок друга
router.get('/friends/:friendId/ratings/:year/:month', authMiddleware, async (req, res) => {
    try {
        const { friendId, year, month } = req.params;
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        
        // Проверка, что пользователь и друг - друзья
        const isFriend = await query(
            `SELECT id FROM friends 
             WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
             AND status = 'accepted'`,
            [req.userId, friendId]
        );
        
        if (isFriend.rows.length === 0) {
            return res.status(403).json({ error: 'Not friends' });
        }
        
        const result = await query(
            `SELECT date, rating FROM days_ratings 
             WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
            [friendId, startDate, endDate]
        );
        
        const ratings = {};
        result.rows.forEach(row => {
            ratings[row.date.split('T')[0]] = row.rating;
        });
        
        res.json(ratings);
    } catch (error) {
        console.error('Get friend ratings error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Получение статистики друга
router.get('/friends/:friendId/stats', authMiddleware, async (req, res) => {
    try {
        const { friendId } = req.params;
        
        // Проверка, что пользователь и друг - друзья
        const isFriend = await query(
            `SELECT id FROM friends 
             WHERE ((user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1))
             AND status = 'accepted'`,
            [req.userId, friendId]
        );
        
        if (isFriend.rows.length === 0) {
            return res.status(403).json({ error: 'Not friends' });
        }
        
        const result = await query(
            `SELECT 
                COUNT(*) as total_rated,
                COALESCE(ROUND(AVG(rating), 1), 0) as avg_rating,
                COALESCE(MAX(rating), 0) as max_rating,
                COALESCE(MIN(rating), 0) as min_rating
             FROM days_ratings 
             WHERE user_id = $1`,
            [friendId]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get friend stats error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});
module.exports = router;