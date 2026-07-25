const { Client } = require('pg');

async function createDatabase() {
  // Connect to default postgres database
  const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'anshulkumar',
    database: 'postgres', // Connect to postgres default database
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Check if database exists
    const result = await client.query("SELECT 1 FROM pg_database WHERE datname = 'profitterminal'");

    if (result.rowCount === 0) {
      // Create database
      await client.query('CREATE DATABASE profitterminal');
      console.log('Database "profitterminal" created successfully');
    } else {
      console.log('Database "profitterminal" already exists');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createDatabase();
