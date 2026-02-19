import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("render.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

const app = express();
app.use(express.json());
app.use(cors());

/* ===============================
   BASIC ROUTES
================================ */

app.get("/", (req, res) => {
  res.send("NICE Proxy API running 🚀");
});

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* ===============================
   NICE TOKEN
================================ */

async function getNiceToken() {
  const response = await fetch(
    `${process.env.NICE_AUTH_URL}/oauth2/token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.NICE_CLIENT_ID,
        client_secret: process.env.NICE_CLIENT_SECRET,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

app.get("/token", async (req, res) => {
  try {
    const token = await getNiceToken();
    res.json(token);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   DATABASE INIT
================================ */

app.get("/init-db", async (req, res) => {
  try {
    await pool.query(`
      create table if not exists customers (
        id bigserial primary key,
        customer_id text unique not null,
        first_name text not null,
        last_name text not null,
        points int default 0,
        balance numeric(12,2) default 0,
        risk_level text default 'low',
        status text default 'active',
        segment text default 'standard',
        credit_limit numeric(12,2) default 0,
        delinquent boolean default false,
        notes text
      );
    `);

    await pool.query(`
      insert into customers 
      (customer_id, first_name, last_name, points, balance, risk_level, status, segment, credit_limit, delinquent, notes)
      values
      ('1001', 'Sofia',  'Perez',   1250,  320.50, 'low',    'active',  'gold',     5000, false, 'Cliente premium'),
      ('1002', 'Martin', 'Gomez',    120, -45.10, 'medium', 'active',  'silver',   1500, true,  'Cliente con mora'),
      ('1003', 'Camila', 'Lopez',   3200,  980.00, 'low',    'active',  'gold',     8000, false, 'Alta actividad'),
      ('1004', 'Juan',   'Diaz',      20,   10.00, 'high',   'blocked', 'standard',  500, true,  'Riesgo alto')
      on conflict (customer_id) do nothing;
    `);

    res.json({ ok: true, message: "Database initialized" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   GET ALL CUSTOMERS
================================ */

app.get("/customers", async (req, res) => {
  try {
    const result = await pool.query(
      `select customer_id, first_name, last_name, points, balance, risk_level, status, segment, credit_limit, delinquent
       from customers
       order by customer_id`
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   GET CUSTOMER BY ID
================================ */

app.get("/customer/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `select customer_id, first_name, last_name, points, balance, risk_level, status, segment, credit_limit, delinquent, notes
       from customers
       where customer_id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ ok: false, message: "Customer not found" });
    }

    res.json({ ok: true, customer: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/* ===============================
   VALIDATE CUSTOMER (FOR NICE)
================================ */

app.post("/validate-customer", async (req, res) => {
  try {
    const { customerId, lastName } = req.body || {};

    if (!customerId || !lastName) {
      return res.status(400).json({
        ok: false,
        reason: "MISSING_FIELDS",
        message: "customerId and lastName are required",
      });
    }

    const result = await pool.query(
      `select customer_id, first_name, last_name, points, balance, risk_level, status, segment, credit_limit, delinquent, notes
       from customers
       where customer_id = $1 and lower(last_name) = lower($2)`,
      [String(customerId).trim(), String(lastName).trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        ok: false,
        reason: "NOT_FOUND",
        message: "Customer not found or last name mismatch",
      });
    }

    return res.json({
      ok: true,
      customer: result.rows[0],
    });
  } catch (error) {
    return res
      .status(500)
      .json({ ok: false, reason: "ERROR", message: error.message });
  }
});

/* ===============================
   START SERVER
================================ */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
