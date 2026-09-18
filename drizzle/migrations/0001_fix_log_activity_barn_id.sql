CREATE OR REPLACE FUNCTION public.log_activity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row JSONB;
  v_old JSONB;
  v_label TEXT;
  v_action TEXT;
  v_name TEXT;
  v_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_row := to_jsonb(OLD); v_old := to_jsonb(OLD); v_action := 'deleted';
  ELSIF TG_OP = 'UPDATE' THEN
    v_row := to_jsonb(NEW); v_old := to_jsonb(OLD); v_action := 'updated';
  ELSE
    v_row := to_jsonb(NEW); v_old := NULL; v_action := 'created';
  END IF;

  IF TG_TABLE_NAME = 'animals' AND TG_OP = 'UPDATE' THEN
    IF (v_row ? 'barn_id') AND (v_row->>'barn_id') IS DISTINCT FROM (v_old->>'barn_id') THEN
      v_action := 'moved';
    END IF;
  END IF;

  v_id := (v_row->>'id')::uuid;
  v_label := COALESCE(v_row->>'tag_number', v_row->>'name', v_row->>'code', v_row->>'feed_type', v_row->>'diagnosis');
  IF v_label IS NULL AND (v_row ? 'animal_id') THEN
    SELECT a.tag_number INTO v_label FROM public.animals a WHERE a.id = (v_row->>'animal_id')::uuid;
  END IF;

  SELECT p.full_name INTO v_name FROM public.profiles p WHERE p.id = auth.uid();

  INSERT INTO public.activity_logs(user_id, user_name, action, entity_type, entity_id, entity_label, details)
  VALUES (auth.uid(), v_name, v_action, TG_TABLE_NAME, v_id, v_label,
    CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object('before', v_old, 'after', v_row) ELSE v_row END);

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $function$;