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
// This automatically strips ".." from requests to prevent file system access attacks
app.use((req, res, next) => {
    const clean = (input) => {
        if (typeof input === 'string') {
            return input.replace(/\.\./g, ''); // Remove ".." characters
        }
        return input;
    };

    // Clean request query parameters (e.g. ?id=../../)
    if (req.query) {
        for (const key in req.query) {
            req.query[key] = clean(req.query[key]);
        }
    }

    // Clean URL parameters (e.g. /api/brand/../../)
    if (req.params) {
        for (const key in req.params) {
            req.params[key] = clean(req.params[key]);
        }
    }

    next();
});

// --- FIX 2: UPDATED SECURITY HEADERS (CSP) ---
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],

                scriptSrc: [
                    "'self'",
                    "https://js.stripe.com"
                ],

                styleSrc: [
                    "'self'",
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

                /** 🔒 REQUIRED BY ZAP **/
                formAction: ["'self'"],            // FIX 1
                frameAncestors: ["'none'"],         // FIX 2

                objectSrc: ["'none'"],
                baseUri: ["'self'"],

                upgradeInsecureRequests: null,
            },
        },
        crossOriginResourcePolicy: { policy: "cross-origin" },
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