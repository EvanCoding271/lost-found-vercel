import asyncpg
from .config import DATABASE_URL
pool=None
async def init_db():
    global pool
    pool=await asyncpg.create_pool(DATABASE_URL,min_size=1,max_size=5,command_timeout=30)
async def close_db():
    global pool
    if pool: await pool.close(); pool=None
async def get_db():
    if pool is None: raise RuntimeError('Database pool is not initialized')
    async with pool.acquire() as conn: yield conn
