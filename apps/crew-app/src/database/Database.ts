import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

export const getDBConnection = async () => {
  return SQLite.openDatabase({ name: 'kombi_crew.db', location: 'default' });
};

export const initDatabase = async () => {
  const db = await getDBConnection();
  
  // Create tables for stops, speed violations, and sync queue
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS roadside_stops (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      dwell_duration_seconds INTEGER NOT NULL,
      max_speed_before_stop_kmh REAL NOT NULL,
      is_mock_location INTEGER NOT NULL,
      sync_status TEXT DEFAULT 'PENDING'
    );
  `);

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS speed_violations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      recorded_speed_kmh REAL NOT NULL,
      speed_limit_kmh REAL NOT NULL,
      sync_status TEXT DEFAULT 'PENDING'
    );
  `);
};
