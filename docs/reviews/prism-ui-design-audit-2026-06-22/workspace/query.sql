select
  id,
  title,
  updated_at
from prism_documents
where status = 'draft'
order by updated_at desc
limit 20;
