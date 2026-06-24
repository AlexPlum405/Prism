select
  id,
  title,
  updated_at
from documents
where status = 'ready'
order by updated_at desc;

