const { Client } = require('pg');
require('dotenv').config();

async function test() {
  const url = process.env.DATABASE_URL;
  console.log('Connecting to:', url.replace(/:([^:@]+)@/, ':***@'));

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    console.log('✅ Connected!', res.rows[0].version);
    await client.end();
  } catch (err) {
    console.error('❌ Failed:', err.message);
  }
}

test();
