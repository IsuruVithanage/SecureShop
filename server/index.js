require('dotenv').config();
const express = require('express');
const chalk = require('chalk');
const cors = require('cors');
const helmet = require('helmet');

const keys = require('./config/keys');
const routes = require('./routes');
const socket = require('./socket');
const setupDB = require('./utils/db');

const { port } = keys;
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// --- FIX 1: PATH TRAVERSAL PROTECTION MIDDLEWARE ---
app.use((req, res, next) => {
    const clean = (input) => {
        if (typeof input === 'string') {
            return input.replace(/\.\./g, ''); // Remove ".." characters
        }
        return input;
    };

    if (req.query) {
        for (const key in req.query) {
            req.query[key] = clean(req.query[key]);
        }
    }

    if (req.params) {
        for (const key in req.params) {
            req.params[key] = clean(req.params[key]);
        }
    }

    next();
});

// --- FIX 2: INFRASTRUCTURE SECURITY HEADERS (Helmet) ---
app.use(
    helmet({
        // 1. Content Security Policy (XSS Protection)
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    "https://js.stripe.com",
                    "'unsafe-eval'" // Needed for some React builds, remove if possible
                ],
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'",
                    "https://fonts.googleapis.com"
                ],
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com"
                ],
                imgSrc: [
                    "'self'",
                    "data:",
                    "https://res.cloudinary.com"
                ],
                connectSrc: [
                    "'self'",
                    "http://localhost:3000",
                    "http://localhost:8080"
                ],
                formAction: ["'self'"],
                frameAncestors: ["'none'"], // Modern Clickjacking Protection
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                upgradeInsecureRequests: null,
            },
        },
        frameguard: { action: 'deny' },

        noSniff: true,

        hidePoweredBy: true,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    })
);

// --- 3. CORS FIX (Explicitly Allow Frontend) ---
app.use(cors({
    origin: 'http://localhost:8080',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

setupDB();
require('./config/passport')(app);
app.use(routes);

const server = app.listen(port, () => {
    console.log(
        `${chalk.green('✓')} ${chalk.blue(
            `Listening on port ${port}. Visit http://localhost:${port}/ in your browser.`
        )}`
    );
});

socket(server);