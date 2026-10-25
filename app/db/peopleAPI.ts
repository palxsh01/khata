import db from './database';

export interface Person {
  id: number;
  name: string;
  created_at: string;
}

export function getAll(): Person[] {
  return db.getAllSync<Person>(
    `SELECT * FROM people
    ORDER BY name`
  );
}

export function getByID(id: number): Person | null {
  return db.getFirstSync<Person>(
    `SELECT * FROM people
    WHERE id = ?`,
    [id]
  );
}

export function create(name: string): number {
  return db.runSync(
    `INSERT INTO people (name)
    VALUES(?)`,
    [name.trim()]
  ).lastInsertRowId;
}

export function update(id: number, name: string): void {
  db.runSync(
    `UPDATE people
    SET name = ?
    WHERE id = ?`,
    [
      name.trim(),
      id
    ]
  );
}

export function remove(id: number): void {
  // throws FK error if the person still has splits
  db.runSync(
    `DELETE FROM people
    WHERE id = ?`,
    [id]
  );
}