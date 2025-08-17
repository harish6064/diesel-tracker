const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { stringify } = require("csv-stringify");

const PORT = process.env.PORT || 8080;
const DB_FILE = process.env.SQLITE_FILE || "./data.db";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

const db = new sqlite3.Database(DB_FILE);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS diesel_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lorry_number TEXT NOT NULL,
    record_date TEXT NOT NULL,
    price REAL NOT NULL,
    liters REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
});

function validate(body) {
  const errors = [];
  if (!body.lorry_number || !String(body.lorry_number).trim()) errors.push("lorry_number is required");
  if (!body.record_date) errors.push("record_date is required (YYYY-MM-DD)");
  if (Number(body.price) <= 0 || isNaN(Number(body.price))) errors.push("price must be a positive number");
  if (Number(body.liters) <= 0 || isNaN(Number(body.liters))) errors.push("liters must be a positive number");
  return errors;
}

app.post("/api/records", (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const { lorry_number, record_date, price, liters } = req.body;
  db.run(
    `INSERT INTO diesel_records (lorry_number, record_date, price, liters) VALUES (?, ?, ?, ?)`,
    [String(lorry_number).trim(), record_date, price, liters],
    function (err) {
      if (err) return res.status(500).json({ error: "Failed to create record" });
      db.get(`SELECT * FROM diesel_records WHERE id = ?`, [this.lastID], (e2, row) => {
        if (e2) return res.status(500).json({ error: "Failed to fetch created record" });
        res.status(201).json(row);
      });
    }
  );
});

app.get("/api/records", (req, res) => {
  const { start_date, end_date } = req.query;
  const clauses = [];
  const params = [];
  if (start_date) { clauses.push(`date(record_date) >= date(?)`); params.push(start_date); }
  if (end_date)   { clauses.push(`date(record_date) <= date(?)`); params.push(end_date); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT id, lorry_number, record_date, price, liters, created_at
               FROM diesel_records
               ${where}
               ORDER BY date(record_date) DESC, id DESC`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to fetch records" });
    res.json(rows);
  });
});

app.get("/api/records/csv", (req, res) => {
  const { start_date, end_date } = req.query;
  const clauses = [];
  const params = [];
  if (start_date) { clauses.push(`date(record_date) >= date(?)`); params.push(start_date); }
  if (end_date)   { clauses.push(`date(record_date) <= date(?)`); params.push(end_date); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT id, lorry_number, record_date, price, liters, created_at
               FROM diesel_records
               ${where}
               ORDER BY date(record_date) DESC, id DESC`;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: "Failed to export CSV" });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="diesel-records.csv"');
    const stringifier = stringify({ header: true, columns: ["id","lorry_number","record_date","price","liters","created_at"] });
    rows.forEach(r => stringifier.write(r));
    stringifier.pipe(res);
    stringifier.end();
  });
});

app.delete("/api/records/:id", (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  db.run(`DELETE FROM diesel_records WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: "Failed to delete record" });
    if (this.changes === 0) return res.status(404).json({ error: "Record not found" });
    res.json({ success: true, id });
  });
});

app.listen(PORT, () => console.log(`SQLite server listening on http://localhost:${PORT}`));
