import uuid
from .auth import supabase_admin
from .config import STORAGE_BUCKET

def upload_photo(file,folder):
    if not file:return None
    data=file.file.read()
    if len(data)>5*1024*1024: raise ValueError('Photo is larger than 5 MB')
    ext='.jpg'
    name=(file.filename or '').lower()
    for e in ('.png','.jpeg','.jpg','.webp'):
        if name.endswith(e):ext=e;break
    path=f'{folder}/{uuid.uuid4().hex}{ext}'
    supabase_admin.storage.from_(STORAGE_BUCKET).upload(path,data,{'content-type':file.content_type or 'image/jpeg','upsert':False})
    return supabase_admin.storage.from_(STORAGE_BUCKET).get_public_url(path)
