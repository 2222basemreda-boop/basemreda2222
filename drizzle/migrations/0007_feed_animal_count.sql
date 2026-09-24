ALTER TABLE public.feed_records ADD COLUMN IF NOT EXISTS animal_count integer;

CREATE OR REPLACE FUNCTION public.animals_in_barn_on(_barn_id uuid, _day date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM (
    SELECT a.id,
      COALESCE(
        (SELECT m.to_barn_id FROM barn_movements m WHERE m.animal_id = a.id AND m.moved_at::date <= _day ORDER BY m.moved_at DESC LIMIT 1),
        (SELECT m.from_barn_id FROM barn_movements m WHERE m.animal_id = a.id AND m.moved_at::date > _day ORDER BY m.moved_at ASC LIMIT 1),
        CASE WHEN NOT EXISTS (SELECT 1 FROM barn_movements m WHERE m.animal_id = a.id AND m.moved_at::date > _day) THEN a.barn_id END
      ) AS barn_on_day
    FROM animals a
    WHERE a.entry_date <= _day
      AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.animal_id = a.id AND s.cancelled_at IS NULL AND s.sale_date < _day)
  ) x
  WHERE (_barn_id IS NULL OR x.barn_on_day = _barn_id);
$$;
GRANT EXECUTE ON FUNCTION public.animals_in_barn_on(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_feed_animal_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.feed_date IS DISTINCT FROM OLD.feed_date OR NEW.barn_id IS DISTINCT FROM OLD.barn_id OR NEW.animal_count IS NULL THEN
    NEW.animal_count := public.animals_in_barn_on(NEW.barn_id, NEW.feed_date);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_feed_animal_count ON public.feed_records;
CREATE TRIGGER trg_feed_animal_count BEFORE INSERT OR UPDATE ON public.feed_records
FOR EACH ROW EXECUTE FUNCTION public.set_feed_animal_count();

UPDATE public.feed_records SET animal_count = public.animals_in_barn_on(barn_id, feed_date) WHERE animal_count IS NULL;