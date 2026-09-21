-- Rating is gone. Preference is learned from the votes people already cast
-- every evening, so a new housemate is never handed a rating chore before
-- they can take part in a single dinner. See src/lib/scoring/taste.ts.
drop trigger if exists dish_ratings_touch_updated_at on public.dish_ratings;

-- Takes its policies, its index and its grants with it.
drop table if exists public.dish_ratings;

-- There is no baseline rating any more for the slot to be named after.
alter type public.slot_type rename value 'high_baseline' to 'favourite';
