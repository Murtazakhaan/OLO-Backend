"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCsvBuffer = void 0;
const toISODate = (d) => {
    if (!d)
        return "";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};
const centsToMoney = (c, prefix = "$") => {
    const n = typeof c === "number" ? c : 0;
    return `${prefix}${(n / 100).toFixed(2)}`;
};
const fmtHours = (n) => typeof n === "number" ? n.toFixed(2) : "0.00";
const csvEscape = (val, delimiter) => {
    // Convert value to string, escape quotes, and wrap in quotes if needed
    const s = val === null || val === undefined ? "" : String(val);
    const needsQuote = s.includes('"') || s.includes("\n") || s.includes("\r") || s.includes(delimiter);
    const escaped = s.replace(/"/g, '""');
    return needsQuote ? `"${escaped}"` : escaped;
};
const createCsvBuffer = (data, opts = {}) => {
    const delimiter = opts.delimiter ?? ",";
    const eol = opts.eol ?? "\r\n";
    const withBOM = opts.withBOM ?? true;
    const includeSummary = opts.includeSummary ?? true;
    const moneyPrefix = opts.moneyPrefix ?? "$";
    const items = Array.isArray(data.items) ? data.items : [];
    // --- Summary block (top) ---
    const lines = [];
    if (includeSummary) {
        lines.push("Summary");
        const meta = data.meta || {};
        const totals = data.totals || {};
        const summaryRows = [
            ["TimesheetId", meta.timesheetId ?? ""],
            ["Period", data.period ?? ""],
            ["Status", meta.status ?? ""],
            ["TrainerName", meta.trainerName ?? ""],
            ["TrainerEmail", meta.trainerEmail ?? ""],
            ["TrainerPhone", meta.trainerPhone ?? ""],
            ["Total Hours", fmtHours(totals.hours)],
            ["Total KM", totals.km ?? 0],
            // --- price-related summary fields commented out ---
            // ["Labour", centsToMoney(totals.amountCents, moneyPrefix)],
            // ["Mileage", centsToMoney(totals.mileageCents, moneyPrefix)],
            // ["Grand Total", centsToMoney(totals.totalCents, moneyPrefix)],
        ];
        summaryRows.forEach(([k, v]) => {
            lines.push(`${csvEscape(k, delimiter)}${delimiter}${csvEscape(v, delimiter)}`);
        });
        lines.push(""); // blank line
        lines.push("Items");
    }
    // --- Items table ---
    const cols = opts.itemColumns ??
        [
            "Date",
            "Service",
            "ParticipantName",
            "ParticipantEmail",
            "ParticipantPhone",
            // "ParticipantStatus", // optional; keep commented out like before
            "Hours",
            "KM",
            // --- price-related columns commented out ---
            // "Amount",
            // "Mileage",
            // "Total",
            "Notes",
        ];
    // Header
    lines.push(cols.map((c) => csvEscape(c, delimiter)).join(delimiter));
    // Rows
    items.forEach((i) => {
        const rowMap = {
            Date: i.dateISO || toISODate(i.date),
            Service: i.service ?? "",
            ParticipantName: i.participant?.name ?? "",
            ParticipantEmail: i.participant?.email ?? "",
            ParticipantPhone: i.participant?.phone ?? "",
            ParticipantStatus: i.participant?.status ?? "",
            Hours: fmtHours(i.hours),
            KM: typeof i.km === "number" ? i.km : 0,
            // Amount: i.amount ?? (typeof i.amountCents === "number" ? (i.amountCents / 100).toFixed(2) : "0.00"),
            // Mileage: i.mileage ?? (typeof i.mileageCents === "number" ? (i.mileageCents / 100).toFixed(2) : "0.00"),
            // Total: i.total ?? (typeof i.totalCents === "number" ? (i.totalCents / 100).toFixed(2) : "0.00"),
            Notes: i.notes ?? "",
        };
        const line = cols.map((c) => csvEscape(rowMap[c] ?? "", delimiter)).join(delimiter);
        lines.push(line);
    });
    // Ensure at least one empty row when there are no items (so Excel shows headers)
    if (items.length === 0) {
        const blank = cols.map(() => "").join(delimiter);
        lines.push(blank);
    }
    const csvString = lines.join(eol);
    const withBomPrefix = withBOM ? "\uFEFF" : "";
    return Buffer.from(withBomPrefix + csvString, "utf8");
};
exports.createCsvBuffer = createCsvBuffer;
