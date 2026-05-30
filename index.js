const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendar');
const userRoutes = require('./routes/user');

const app = express();

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Статические файлы для загруженных аватаров
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ============ РОУТЫ ============

// Auth routes (регистрация, логин)
app.use('/api/auth', authRoutes);

// Calendar routes (оценки дней)
app.use('/api/calendar', calendarRoutes);

// User routes (профиль, друзья, уведомления)
app.use('/api/user', userRoutes);

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date(),
        uptime: process.uptime(),
        message: 'DayTracer server is running'
    });
});

// ============ ROOT ENDPOINT ============
app.get('/', (req, res) => {
    res.json({
        name: 'DayTracer API',
        version: '1.0.0',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me'
            },
            calendar: {
                rate: 'POST /api/calendar/rate',
                getRatings: 'GET /api/calendar/ratings/:year/:month',
                stats: 'GET /api/calendar/stats'
            },
            user: {
                profile: 'GET /api/user/profile',
                updateProfile: 'PUT /api/user/profile',
                uploadAvatar: 'POST /api/user/avatar',
                getNotifications: 'GET /api/user/notifications',
                markNotificationRead: 'PUT /api/user/notifications/:id/read',
                getFriends: 'GET /api/user/friends',
                addFriend: 'POST /api/user/friends',
                acceptFriend: 'PUT /api/user/friends/:id/accept',
                rejectFriend: 'PUT /api/user/friends/:id/reject'
            }
        }
    });
});

// ============ ERROR HANDLING MIDDLEWARE ============
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ 
        error: 'Something went wrong!',
        message: err.message 
    });
});

// ============ 404 HANDLER ============
app.use((req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl
    });
});

// ============ ЗАПУСК СЕРВЕРА ============
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 DayTracer Server is running!`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/health`);
    console.log(`📍 API root: http://localhost:${PORT}/`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Обработка graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});