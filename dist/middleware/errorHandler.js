"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../utils/errors");
function errorHandler(err, req, res, _next) {
    // You can add winston/pino logger here
    console.error(`[ERROR] ${err.message}`, err);
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({
            success: false,
            message: err.message,
            errors: err.errors || null,
        });
    }
    return res.status(500).json({
        success: false,
        message: "Internal Server Error",
    });
}
