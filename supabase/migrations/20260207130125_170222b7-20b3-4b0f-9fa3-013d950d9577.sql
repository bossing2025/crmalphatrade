create or replace function public.trg_log_lead_status_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.status is distinct from old.status) then
    insert into public.lead_status_history (
      lead_id,
      field_name,
      old_value,
      new_value,
      change_source,
      changed_by
    ) values (
      new.id,
      'status',
      old.status::text,
      new.status::text,
      'db_trigger',
      auth.uid()::text
    );
  end if;

  if (new.sale_status is distinct from old.sale_status) then
    insert into public.lead_status_history (
      lead_id,
      field_name,
      old_value,
      new_value,
      change_source,
      changed_by
    ) values (
      new.id,
      'sale_status',
      old.sale_status,
      new.sale_status,
      'db_trigger',
      auth.uid()::text
    );
  end if;

  if (new.is_ftd is distinct from old.is_ftd) then
    insert into public.lead_status_history (
      lead_id,
      field_name,
      old_value,
      new_value,
      change_source,
      changed_by
    ) values (
      new.id,
      'is_ftd',
      case when old.is_ftd then 'true' else 'false' end,
      case when new.is_ftd then 'true' else 'false' end,
      'db_trigger',
      auth.uid()::text
    );
  end if;

  return new;
end;
$$;