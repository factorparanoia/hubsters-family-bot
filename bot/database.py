
import aiosqlite

class Database:
    def __init__(self, path="bot.db"):
        self.path = path

    async def init(self):
        async with aiosqlite.connect(self.path) as db:
            await db.execute("CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, text TEXT)")
            await db.commit()
