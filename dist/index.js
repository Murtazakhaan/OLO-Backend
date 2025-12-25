"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.corsOptions = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const env_1 = require("./config/env");
const health_1 = __importDefault(require("./routes/health"));
const errorHandler_1 = require("./middleware/errorHandler");
const routes_1 = __importDefault(require("./routes"));
const mongoose_1 = require("./utils/mongoose");
const path_1 = __importDefault(require("path"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)());
const FRONTEND_ORIGIN = "https://olo-frontend.onrender.com";
exports.corsOptions = {
    origin: ["https://olo-frontend.onrender.com", 'http://localhost:3000'],
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};
app.use((0, cors_1.default)(exports.corsOptions));
app.set("trust proxy", 1);
app.use((0, cookie_parser_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.disable("x-powered-by");
// Routes
app.use("/health", health_1.default);
// Root 
app.get("/", (_, res) => {
    res.send("CareLink API is running 🚀");
});
// serve static uploads
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
(0, mongoose_1.connectDB)();
// Centralized routes
app.use("/api", routes_1.default);
// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
    });
});
// Global error handler
app.use(errorHandler_1.errorHandler);
// Start server
app.listen(env_1.ENV.PORT, () => {
    console.log(`⚡️ Server running in ${env_1.ENV.NODE_ENV} on http://localhost:${env_1.ENV.PORT}`);
});
