-- Rebrand the one notification this function sends.
--
-- `delete_account_data` is called when a vet deletes their account: every farmer
-- with a pending or accepted booking is told the vet has left. The wording in
-- 20261013100000 said "Farmers Connect". The rest of the function is copied from
-- that migration unchanged — only that string differs.
--
-- Applied migrations are never edited (CLAUDE.md), so the body is replaced here
-- instead. Push it with `npx supabase db push`, then run `npm run test:security`
-- and `npx supabase db advisors --linked`.

create or replace function public.delete_account_data(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ident text;
  supplier_ids uuid[];
  product_ids uuid[];
  message_ids uuid[];
  batch_ids uuid[];
  files text[] := '{}';
  private_files text[] := '{}';
  counts jsonb := '{}'::jsonb;
  n bigint;
begin
  select coalesce(nullif(u.email, ''), nullif(u.phone, '')) into ident
    from auth.users u where u.id = p_user_id;
  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
  if exists (select 1 from auth.users u where u.id = p_user_id and u.raw_app_meta_data ->> 'role' = 'admin') then
    raise exception 'admin accounts are removed by the project owner' using errcode = '42501';
  end if;

  -- ----- files to remove afterwards (collected before the rows go) -----
  select coalesce(array_agg(u), '{}') into files from (
    select avatar_url as u from public.farmer_profiles where user_email = ident and coalesce(avatar_url, '') <> ''
    union select image_url from public.farm_gallery where user_email = ident and coalesce(image_url, '') <> ''
    union select image_url from public.community_chat where user_email = ident and coalesce(image_url, '') <> ''
    union select image_url from public.vet_questions where (user_email = ident or farmer_id = p_user_id) and coalesce(image_url, '') <> ''
    union select photo_url from public.vet_profiles where user_id = p_user_id and coalesce(photo_url, '') <> ''
    union select logo_url from public.supplier_profiles where user_id = p_user_id and coalesce(logo_url, '') <> ''
    union select p.image_url from public.products p
      where (p.user_email = ident or p.supplier_id in (select s.id from public.supplier_profiles s where s.user_id = p_user_id))
        and coalesce(p.image_url, '') <> ''
  ) x;
  -- lab results written FOR this person as a farmer go with them
  select coalesce(array_agg(file_path), '{}') into private_files
    from public.vet_medical_records
   where (farmer_id = p_user_id or (ident is not null and farmer_email = ident)) and coalesce(file_path, '') <> '';

  -- ----- Clucky, notifications -----
  delete from public.clucky_messages where user_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('clucky_messages', n);
  delete from public.clucky_usage where user_id = p_user_id;
  delete from public.notifications where user_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('notifications', n);
  delete from public.notification_preferences where user_email = ident;

  -- ----- community -----
  select coalesce(array_agg(id), '{}') into message_ids from public.community_chat where user_email = ident;
  -- what other members quoted from this person's messages
  update public.community_chat
     set reply_to_user = 'Former member', reply_to_message = null
   where reply_to_id = any (message_ids);
  delete from public.message_reactions where user_email = ident;
  delete from public.community_reports where reporter = ident;
  delete from public.community_chat where id = any (message_ids);   -- reactions and reports on them cascade
  get diagnostics n = row_count; counts := counts || jsonb_build_object('community_messages', n);
  delete from public.community_mutes where user_email = ident;
  delete from public.user_blocks where blocker = ident or blocked = ident;
  delete from public.content_reports
   where reporter = ident or (kind = 'member' and target_id = ident);

  -- ----- farm records -----
  select coalesce(array_agg(id), '{}') into batch_ids from public.farm_batches where user_email = ident;
  delete from public.vaccination_tasks where user_email = ident or batch_id = any (batch_ids);
  delete from public.mortality_logs where user_email = ident or batch_id = any (batch_ids);
  delete from public.batch_expenses where user_id = p_user_id or batch_id = any (batch_ids);
  delete from public.batch_sales where user_id = p_user_id or batch_id = any (batch_ids);
  delete from public.farm_gallery where user_email = ident or batch_id = any (batch_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('gallery_photos', n);
  delete from public.feed_calculations where user_email = ident;
  delete from public.farm_batches where id = any (batch_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('batches', n);
  delete from public.farm_tasks where user_email = ident;
  delete from public.farm_finances where user_email = ident;

  -- ----- marketplace -----
  select coalesce(array_agg(id), '{}') into supplier_ids from public.supplier_profiles where user_id = p_user_id;
  select coalesce(array_agg(id), '{}') into product_ids from public.products
   where user_email = ident or supplier_id = any (supplier_ids);
  delete from public.content_reports where kind = 'listing' and target_id = any (select unnest(product_ids)::text);
  delete from public.contact_events
   where contacted_by = p_user_id or supplier_id = any (supplier_ids) or product_id = any (product_ids);
  -- orders this person placed carry their name and phone number
  delete from public.orders where buyer_id = p_user_id;
  -- orders other people placed with them keep the item and amounts only
  update public.orders set supplier_id = null where supplier_id = any (supplier_ids);
  delete from public.products where id = any (product_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('listings', n);
  delete from public.supplier_profiles where id = any (supplier_ids);
  get diagnostics n = row_count; counts := counts || jsonb_build_object('supplier_profiles', n);

  -- ----- vet services: this person as a FARMER -----
  delete from public.vet_farmer_messages
   where farmer_id = p_user_id or farmer_email = ident or vet_id = p_user_id or vet_email = ident or sender_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('vet_messages', n);
  delete from public.vet_medical_records where farmer_id = p_user_id or farmer_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('medical_records', n);
  delete from public.visit_records where farmer_id = p_user_id or farmer_email = ident;
  delete from public.vet_questions where user_email = ident or farmer_id = p_user_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('vet_questions', n);
  -- a question that became one of this farmer's bookings lets go of it first
  update public.vet_questions set escalated_appointment_id = null
   where escalated_appointment_id in (select a.id from public.vet_appointments a where a.farmer_id = p_user_id or a.farmer_email = ident);
  delete from public.vet_appointments where farmer_id = p_user_id or farmer_email = ident;   -- visit records cascade
  get diagnostics n = row_count; counts := counts || jsonb_build_object('appointments', n);

  -- ----- vet services: this person as a VET -----
  -- bookings that never happened are removed; the farmer is told
  perform public.push_notification(
    a.farmer_email, 'appointment', 'A vet booking was cancelled',
    'The vet you booked for ' || to_char(a.appointment_date, 'DD Mon') || ' is no longer on Kiliforma. Please book another vet in Ask Vet.',
    '/bookings', 'vet-left:' || a.id)
    from public.vet_appointments a
   where (a.vet_id = p_user_id or a.vet_email = ident or a.requested_vet_id = p_user_id)
     and a.status in ('pending', 'accepted') and a.farmer_email is not null;
  update public.vet_questions set escalated_appointment_id = null
   where escalated_appointment_id in (
     select a.id from public.vet_appointments a
      where (a.vet_id = p_user_id or a.vet_email = ident or a.requested_vet_id = p_user_id) and a.status in ('pending', 'accepted'));
  delete from public.vet_appointments a
   where (a.vet_id = p_user_id or a.vet_email = ident or a.requested_vet_id = p_user_id) and a.status in ('pending', 'accepted');
  -- finished visits stay in the farmer's history, without the vet's identity
  update public.vet_appointments
     set vet_id = case when vet_id = p_user_id then null else vet_id end,
         requested_vet_id = case when requested_vet_id = p_user_id then null else requested_vet_id end,
         vet_email = case when vet_email = ident then null else vet_email end
   where vet_id = p_user_id or requested_vet_id = p_user_id or vet_email = ident;
  update public.visit_records set vet_id = null, vet_email = null where vet_id = p_user_id or vet_email = ident;
  update public.vet_medical_records set vet_id = null, vet_email = null where vet_id = p_user_id or vet_email = ident;
  update public.vet_questions set assigned_vet = null where assigned_vet = ident;
  delete from public.vet_blocked_dates where vet_id = p_user_id;
  delete from public.vet_profiles where user_id = p_user_id;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('vet_profiles', n);

  -- ----- the profile itself, last -----
  delete from public.farmer_profiles where user_email = ident;
  get diagnostics n = row_count; counts := counts || jsonb_build_object('profiles', n);

  -- requests this person sent from the web page are settled by the deletion
  update public.account_requests
     set status = 'done', resolved_at = now(), resolved_by = 'account deleted', identity = 'deleted account', message = null
   where identity = ident;

  return jsonb_build_object('files', to_jsonb(files), 'private_files', to_jsonb(private_files), 'counts', counts);
end;
$$;
