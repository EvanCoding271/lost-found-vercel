import os
from dotenv import load_dotenv
load_dotenv()
SUPABASE_URL=os.getenv('SUPABASE_URL','')
SUPABASE_ANON_KEY=os.getenv('SUPABASE_ANON_KEY','')
SUPABASE_SERVICE_ROLE_KEY=os.getenv('SUPABASE_SERVICE_ROLE_KEY','')
DATABASE_URL=os.getenv('DATABASE_URL','')
SESSION_SECRET=os.getenv('SESSION_SECRET','')
STORAGE_BUCKET=os.getenv('STORAGE_BUCKET','lost-found')
SCHOOL_EMAIL_DOMAIN=os.getenv('SCHOOL_EMAIL_DOMAIN','').strip().lower()
FRONTEND_ORIGINS=[x.strip() for x in os.getenv('FRONTEND_ORIGINS','').split(',') if x.strip()]
for name,value in [('SUPABASE_URL',SUPABASE_URL),('SUPABASE_ANON_KEY',SUPABASE_ANON_KEY),('SUPABASE_SERVICE_ROLE_KEY',SUPABASE_SERVICE_ROLE_KEY),('DATABASE_URL',DATABASE_URL),('SESSION_SECRET',SESSION_SECRET)]:
    if not value: raise RuntimeError(f'{name} is missing')
