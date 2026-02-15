import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.resolve(__dirname, "..", "data", "patients.json");
function ensureDbFile() {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir))
        fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ patients: [] }));
    }
}
function readDb() {
    ensureDbFile();
    const raw = fs.readFileSync(DB_PATH, "utf8");
    try {
        return JSON.parse(raw);
    }
    catch {
        return { patients: [] };
    }
}
function writeDb(db) {
    ensureDbFile();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
export function listPatients() {
    return readDb().patients;
}
export function getPatient(id) {
    return readDb().patients.find((p) => p.id === id);
}
export function addPatient(patient) {
    const db = readDb();
    db.patients.push(patient);
    writeDb(db);
}
export function deletePatient(id) {
    const db = readDb();
    const before = db.patients.length;
    db.patients = db.patients.filter((p) => p.id !== id);
    writeDb(db);
    return db.patients.length < before;
}
export function addReport(id, text) {
    const db = readDb();
    const p = db.patients.find((x) => x.id === id);
    if (!p)
        return false;
    p.reports.push({ text, timestamp: new Date().toISOString() });
    writeDb(db);
    return true;
}
export function setLabels(id, labels) {
    const db = readDb();
    const p = db.patients.find((x) => x.id === id);
    if (!p)
        return false;
    p.labels = labels;
    writeDb(db);
    return true;
}
export function setCondition(id, condition) {
    const db = readDb();
    const p = db.patients.find((x) => x.id === id);
    if (!p)
        return false;
    p.condition = condition;
    writeDb(db);
    return true;
}
export function setAnalysis(id, analysis) {
    const db = readDb();
    const p = db.patients.find((x) => x.id === id);
    if (!p)
        return false;
    p.analysis = analysis;
    p.medications = analysis.schedule.map((s) => ({
        name: s.medication,
        dose: "per schedule",
        frequencyPerDay: 1,
    }));
    writeDb(db);
    return true;
}
export function addFeedback(id, text, sender = "patient") {
    const db = readDb();
    const p = db.patients.find((x) => x.id === id);
    if (!p)
        return false;
    if (!p.feedback)
        p.feedback = [];
    p.feedback.push({ text, timestamp: new Date().toISOString(), sender });
    writeDb(db);
    return true;
}
