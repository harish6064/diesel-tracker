const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const { stringify } = require("csv-stringify");

const PORT = process.env.PORT || 8080;

// Use Render's DATABASE_URL or local fallback
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://admin:SWy4Z7TM0gSzZsAc3ajVTJzhAXrwSbnc@dpg-d2il12hr0fns738ke3ug-a/lorryoil",
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

// Create table if not exists
(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS diesel_records (
      id SERIAL PRIMARY KEY,
      lorry_number TEXT NOT NULL,
      record_date DATE NOT NULL,
      price NUMERIC NOT NULL,
      liters NUMERIC NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
})();

function validate(body) {
  const errors = [];
  if (!body.lorry_number || !String(body.lorry_number).trim()) errors.push("lorry_number is required");
  if (!body.record_date) errors.push("record_date is required (YYYY-MM-DD)");
  if (Number(body.price) <= 0 || isNaN(Number(body.price))) errors.push("price must be a positive number");
  if (Number(body.liters) <= 0 || isNaN(Number(body.liters))) errors.push("liters must be a positive number");
  return errors;
}

// ✅ Create record
app.post("/api/records", async (req, res) => {
  const errors = validate(req.body);
  if (errors.length) return res.status(400).json({ errors });
  const { lorry_number, record_date, price, liters } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO diesel_records (lorry_number, record_date, price, liters) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [String(lorry_number).trim(), record_date, price, liters]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create record" });
  }
});

// ✅ Fetch records (with optional filters)
app.get("/api/records", async (req, res) => {
  const { start_date, end_date } = req.query;
  const clauses = [];
  const params = [];
  let idx = 1;
  if (start_date) { clauses.push(`record_date >= $${idx++}`); params.push(start_date); }
  if (end_date)   { clauses.push(`record_date <= $${idx++}`); params.push(end_date); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT id, lorry_number, record_date, price, liters, created_at
               FROM diesel_records
               ${where}
               ORDER BY record_date DESC, id DESC`;
  try {
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
});

// ✅ CSV Export
app.get("/api/records/csv", async (req, res) => {
  const { start_date, end_date } = req.query;
  const clauses = [];
  const params = [];
  let idx = 1;
  if (start_date) { clauses.push(`record_date >= $${idx++}`); params.push(start_date); }
  if (end_date)   { clauses.push(`record_date <= $${idx++}`); params.push(end_date); }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT id, lorry_number, record_date, price, liters, created_at
               FROM diesel_records
               ${where}
               ORDER BY record_date DESC, id DESC`;
  try {
    const result = await pool.query(sql, params);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="diesel-records.csv"');
    const stringifier = stringify({ header: true, columns: ["id","lorry_number","record_date","price","liters","created_at"] });
    result.rows.forEach(r => stringifier.write(r));
    stringifier.pipe(res);
    stringifier.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to export CSV" });
  }
});

// ✅ Delete record
app.delete("/api/records/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const result = await pool.query(`DELETE FROM diesel_records WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Record not found" });
    res.json({ success: true, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete record" });
  }
});

app.listen(PORT, () => console.log(`Postgres server running on http://localhost:${PORT}`));
