"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trainerOnboardingSchema = exports.trainerStep5Schema = exports.trainerStep4Schema = exports.trainerStep3Schema = exports.trainerStep2Schema = exports.trainerStep1Schema = void 0;
const zod_1 = require("zod");
/**
 * Step 1: Identity
 */
exports.trainerStep1Schema = zod_1.z
    .object({
    step: zod_1.z.union([zod_1.z.literal(1), zod_1.z.literal("1")]).transform(Number),
    fullName: zod_1.z.string().min(2, "Full name is required"),
    email: zod_1.z.string().email("Invalid email address"),
    phone: zod_1.z
        .string()
        .min(1, "Phone is required"),
    address: zod_1.z.string().optional(),
})
    .passthrough();
/**
 * Step 2: Availability + Travel
 */
const timeRangeSchema = zod_1.z.object({
    start: zod_1.z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
    end: zod_1.z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
});
exports.trainerStep2Schema = zod_1.z
    .object({
    step: zod_1.z.union([zod_1.z.literal(2), zod_1.z.literal("2")]).transform(Number),
    availability: zod_1.z
        .record(zod_1.z.string(), zod_1.z.array(timeRangeSchema))
        .refine((v) => Object.values(v).some((slots) => slots.length > 0), {
        message: "At least one availability slot required",
    }),
    travelAreas: zod_1.z.array(zod_1.z.string()).min(1, "At least one area required"),
})
    .passthrough();
/**
 * Step 3: Specialisations
 */
exports.trainerStep3Schema = zod_1.z
    .object({
    step: zod_1.z.union([zod_1.z.literal(3), zod_1.z.literal("3")]).transform(Number),
    specialisations: zod_1.z.array(zod_1.z.string()).min(1, "Pick at least one"),
})
    .passthrough();
/**
 * Step 4: Documents
 */
exports.trainerStep4Schema = zod_1.z
    .object({
    step: zod_1.z.union([zod_1.z.literal(4), zod_1.z.literal("4")]).transform(Number),
})
    .passthrough();
/**
 * Step 5: Employment Agreement
 */
exports.trainerStep5Schema = zod_1.z.object({
    step: zod_1.z.union([zod_1.z.literal(5), zod_1.z.literal("5")]).transform(Number),
    agreement: zod_1.z.object({
        version: zod_1.z.string().optional(),
        effectiveDate: zod_1.z.coerce.date().optional(),
        tos: zod_1.z.boolean(),
        privacy: zod_1.z.boolean(),
        consent: zod_1.z.boolean(),
        signature: zod_1.z.object({
            dataUrl: zod_1.z.string().optional(), // allow missing if service rewrites
            url: zod_1.z.string().optional(), // allow persisted file path
            date: zod_1.z.coerce.date(),
        }),
        pdfUrl: zod_1.z.string().optional(),
    }),
}).passthrough();
/**
 * Union of all steps
 */
exports.trainerOnboardingSchema = zod_1.z.discriminatedUnion("step", [
    exports.trainerStep1Schema,
    exports.trainerStep2Schema,
    exports.trainerStep3Schema,
    exports.trainerStep4Schema,
    exports.trainerStep5Schema, // 🔹 added
]);
