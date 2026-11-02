'use strict';
// Jadvallar (PostgreSQL va SQLite uchun bir xil). Sanalar "YYYY-MM-DD" matn ko'rinishida saqlanadi.
module.exports = [
  `CREATE TABLE IF NOT EXISTS curators (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    birth_day INTEGER, birth_month INTEGER, birth_year INTEGER,
    hire_date TEXT,
    card_number TEXT,
    kind TEXT NOT NULL DEFAULT 'curator',
    department TEXT,
    staff_role TEXT,
    monthly_salary DOUBLE PRECISION,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS salary_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    params TEXT NOT NULL,
    note TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS flows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    note TEXT,
    start_date TEXT,
    end_date TEXT,
    closed_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS course_groups (
    id TEXT PRIMARY KEY,
    section TEXT NOT NULL,
    flow_id TEXT,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    student_count INTEGER NOT NULL DEFAULT 0,
    closed_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS group_students (
    group_id TEXT NOT NULL,
    month TEXT NOT NULL,
    students INTEGER NOT NULL,
    PRIMARY KEY (group_id, month)
  )`,
  `CREATE TABLE IF NOT EXISTS group_terms (
    group_id TEXT NOT NULL,
    month_no INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    start_students INTEGER,
    end_students INTEGER,
    lessons_total INTEGER NOT NULL DEFAULT 13,
    leavers TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (group_id, month_no)
  )`,
  `CREATE TABLE IF NOT EXISTS assignments (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    curator_id TEXT NOT NULL,
    rule_id TEXT,
    rule_snapshot TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bonuses (
    id TEXT PRIMARY KEY,
    month TEXT NOT NULL,
    kind TEXT NOT NULL,
    curator_id TEXT NOT NULL,
    group_id TEXT,
    quantity DOUBLE PRECISION NOT NULL,
    month_no INTEGER,
    rule_id TEXT,
    rule_snapshot TEXT NOT NULL,
    note TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    month TEXT NOT NULL,
    scope TEXT NOT NULL,
    person_id TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    paid_at TEXT NOT NULL,
    paid_by TEXT,
    PRIMARY KEY (month, scope, person_id)
  )`,
  `CREATE TABLE IF NOT EXISTS month_snapshots (
    month TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    closed_at TEXT NOT NULL,
    closed_by TEXT
  )`,
];
