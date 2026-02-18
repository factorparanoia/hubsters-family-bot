import aiosqlite

DB_NAME = "hubsters.db"

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:

        await db.execute("""
        CREATE TABLE IF NOT EXISTS safe (
            id INTEGER PRIMARY KEY,
            balance INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS safe_logs (
            user TEXT,
            amount INTEGER,
            action TEXT,
            reason TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS warehouse (
            name TEXT PRIMARY KEY,
            amount INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS guns (
            name TEXT PRIMARY KEY,
            amount INTEGER
        )
        """)

        await db.execute("""
        CREATE TABLE IF NOT EXISTS gun_logs (
            user TEXT,
            gun TEXT,
            amount INTEGER,
            action TEXT,
            date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)

        await db.execute("INSERT OR IGNORE INTO safe (id, balance) VALUES (1, 0)")

        await db.commit()
