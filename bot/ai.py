
from openai import AsyncOpenAI
from .config import OPENAI_KEY

client = AsyncOpenAI(api_key=OPENAI_KEY)

async def ask_ai(prompt):
    resp = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role":"user","content":prompt}]
    )
    return resp.choices[0].message.content
