"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const errors_1 = require("../utils/errors");
const validate = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        throw new errors_1.ValidationError(parsed.error.flatten());
    }
    req.body = parsed.data;
    next();
};
exports.validate = validate;
