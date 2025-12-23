"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.success = success;
exports.fail = fail;
function success(res, data, message = "OK", status = 200) {
    return res.status(status).json({
        success: true,
        message,
        data,
    });
}
function fail(res, message = "Bad Request", errors, status = 400) {
    return res.status(status).json({
        success: false,
        message,
        errors,
    });
}
