const { Client } = require('pg');

const connectionString = "postgresql://postgres.tdncfzmttanrozpropox:4jjadYi-%21%3FEN56%21@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres";

async function test() {
  const client = new Client({
    connectionString: connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log("Connecting to:", connectionString);
    await client.connect();
    console.log("Connected successfully!");
    const res = await client.query('SELECT NOW()');
    console.log("Query result:", res.rows[0]);
    await client.end();
  } catch (err) {
    console.error("Connection failed:", err.message);
  }
}

test();
