'use strict';
import pkg from 'pg';
const { Pool } = pkg;
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  user: process.env.PSQL_USER,
  host: process.env.PSQL_HOST,
  database: process.env.PSQL_DATABASE_NAME,
  password: process.env.PSQL_PASSWORD,
  port: process.env.PSQL_PORT,
});

export class Database {
  constructor(type) {
    this.connect(type);
  }

  async connect(type = 'psql') {
    try {
      switch (type) {
        case 'psql':
          await pool.connect();
          console.log('Connected to PostgreSQL server');
          break;
        default:
          throw new Error(`Invalid database type: ${type}`);
      }
    } catch (err) {
      console.error('Connection error', err.stack);
      throw new Error('Connect db error!');
    }
  }

  static getInstance(type) {
    if (!Database.instance) {
      Database.instance = new Database(type);
    }
    return Database.instance;
  }
}

export const query = async (command) => {
  return new Promise((resolve, reject) => {
    pool.query(command, (err, res) => {
      if (err) {
        console.log(err.message);
        reject(new InternalServerError('Query with psql error!'));
      } else {
        resolve(res.rows);
      }
    });
  });
};

export default pool;
