const express = require('express');
const { query } = require('../database/db');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Сохранение оценки дня
router.post('/rate', authMiddleware, async (req, res) => {
    try {
        const { date, rating } = req.body;
        const userId = req.userId;
        
        if (!date || !rating || rating < 1 || rating > 10) {
            return res.status(400).json({ error: 'Invalid date or rating' });
        }
        
        // Проверка, что день не будущий
        const today = new Date().toISOString().split('T')[0];
        if (date > today) {
            return res.status(400).json({ error: 'Cannot rate future days' });
        }
        
        const result = await query(
            `INSERT INTO days_ratings (user_id, date, rating) 
             VALUES ($1, $2, $3) 
             ON CONFLICT (user_id, date) 
             DO UPDATE SET rating = $3, updated_at = CURRENT_TIMESTAMP
             RETURNING *`,
            [userId, date, rating]
        );
        
        res.json({ success: true, rating: result.rows[0] });
    } catch (error) {
        console.error('Save rating error:', error);
        res.status(500).json({ error: 'Server error saving rating' });
    }
});

// Получение оценок за месяц
router.get('/ratings/:year/:month', authMiddleware, async (req, res) => {
    try {
        const { year, month } = req.params;
        const userId = req.userId;
        
        const startDate = `${year}-${month.padStart(2, '0')}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
        
        const result = await query(
            `SELECT date, rating FROM days_ratings 
             WHERE user_id = $1 AND date BETWEEN $2 AND $3`,
            [userId, startDate, endDate]
        );
        
        const ratings = {};
        result.rows.forEach(row => {
            ratings[row.date.split('T')[0]] = row.rating;
        });
        
        res.json(ratings);
    } catch (error) {
        console.error('Get ratings error:', error);
        res.status(500).json({ error: 'Server error fetching ratings' });
    }
});

// Получение статистики пользователя
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        
        const result = await query(
            `SELECT 
                COUNT(*) as total_rated,
                COALESCE(ROUND(AVG(rating), 1), 0) as avg_rating,
                COALESCE(MAX(rating), 0) as max_rating,
                COALESCE(MIN(rating), 0) as min_rating
             FROM days_ratings 
             WHERE user_id = $1`,
            [userId]
        );
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: 'Server error fetching stats' });
    }
});

module.exports = router;