
import os
from dotenv import load_dotenv
load_dotenv()

TOKEN = os.getenv("TOKEN")
OPENAI_KEY = os.getenv("OPENAI_KEY")
GUILD_ID = int(os.getenv("GUILD_ID", "0"))
