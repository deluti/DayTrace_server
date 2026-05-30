const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendar');
const userRoutes = require('./routes/user');
const { testConnection } = require('./database/db');

const app = express();

// Middleware
app.use(cors({
    origin: ['http://localhost:5173', 'https://*.onrender.com'],
    credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', async (req, res) => {
    const dbConnected = await testConnection();
    res.json({ 
        status: 'ok',
        database: dbConnected ? 'connected' : 'disconnected',
        timestamp: new Date()
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'DayTracer API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            auth: {
                register: 'POST /api/auth/register',
                login: 'POST /api/auth/login',
                me: 'GET /api/auth/me'
            },
            calendar: {
                rate: 'POST /api/calendar/rate',
                ratings: 'GET /api/calendar/ratings/:year/:month',
                stats: 'GET /api/calendar/stats'
            }
        }
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/user', userRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Запуск сервера
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    console.log('🔄 Starting DayTracer server...');
    console.log('🔄 Checking database connection...');
    
    const dbConnected = await testConnection();
    
    if (!dbConnected) {
        console.error('❌ Database connection failed. Exiting...');
        process.exit(1);
    }
    
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 DayTracer Server running on port ${PORT}`);
        console.log(`📍 Health check: https://daytracer-server.onrender.com/health`);
    });
};

startServer();