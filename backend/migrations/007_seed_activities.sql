-- Migration 007: seed the activities library and activity_skill_map
-- These rows are required so that POST /api/activity-sessions can create
-- observation_items automatically after each session.
--
-- Activity IDs must match the ids used in frontend/src/activities/activitiesData.js.
-- CAPS refs are cited so every observation item is traceable to a source document.

BEGIN;

-- ── Insert the 8 digital game activities ─────────────────────────────────

INSERT INTO activities (id, subject, name, description, caps_ref, tier, grade_range)
VALUES
  -- English activities
  ('talk-and-turn',
   'English',
   'Talk & Turn',
   'Look, talk and describe using picture prompts. Assesses oral language, vocabulary and sentence construction.',
   'CAPS HL Gr R p.20–21 (oral language, listening and speaking); CAPS HL Gr 1 p.55 (answers questions, takes part)',
   'Seed',
   'R-1'),

  ('sound-hunt',
   'English',
   'Sound Hunt',
   'Find and recognise a target sound across three stages: say it, find it, read it.',
   'CAPS HL Gr R p.34 (beginning sounds of own name); CAPS HL Gr 1 p.56 (phonological awareness)',
   'Seed',
   'R-1'),

  ('sound-sorter',
   'English',
   'Sound Sorter',
   'Match words to their initial sound. Five rounds of two-choice phoneme identification.',
   'CAPS HL Gr 1 p.56 (letter-sound matching, phonics); CAPS HL Gr 2 p.81 (word families)',
   'Sprout',
   '1-2'),

  ('blend-a-word',
   'English',
   'Blend a Word',
   'Tap letter sounds individually then slide them together into a CVC word.',
   'CAPS HL Gr 1 p.56 (blending, segmenting CVC words)',
   'Sprout',
   '1-2'),

  -- Mathematics activities
  ('add-numbers',
   'Mathematics',
   'Add Numbers',
   'Hop along a 0–10 number line to solve a single addition problem. Progressive hint ladder.',
   'CAPS Maths Gr 1 p.22 (addition within 10; number line); CAPS Maths Gr 1 p.12 (counting to 20)',
   'Sprout',
   '1-2'),

  ('bead-string',
   'Mathematics',
   'Bead String',
   'Slide beads across a two-colour string and count to a target number.',
   'CAPS Maths Gr R p.10 (one-to-one correspondence, counting to 5); CAPS Maths Gr 1 p.12 (counting to 20)',
   'Seed',
   'R-1'),

  ('make-a-ten',
   'Mathematics',
   'Make a Ten',
   'Fill a ten-frame by tapping counters from a tray. Bridges through 10.',
   'CAPS Maths Gr 1 p.22 (number bonds to 10; bridging through 10)',
   'Sprout',
   '1-2'),

  ('group-of-5',
   'Mathematics',
   'Group of 5',
   'Tap rows of 5 dots to count in groups. Introduces skip counting and repeated addition.',
   'CAPS Maths Gr 2 p.16 (grouping, repeated addition, skip counting in fives)',
   'Bloom',
   '2-3')

ON CONFLICT (id) DO NOTHING;

-- ── Insert the activity → skill map ──────────────────────────────────────
-- Each row represents one observable skill produced by a completed session.
-- source = 'activity' is set in the route handler when inserting observation_items.

INSERT INTO activity_skill_map (activity_id, subject, skill, caps_ref, item, strategy)
VALUES
  -- talk-and-turn: oral language
  ('talk-and-turn', 'English',
   'oral language and vocabulary',
   'CAPS HL Gr R p.20–21; CAPS HL Gr 1 p.55',
   'uses key vocabulary to describe a picture during a structured speaking activity',
   'other'),

  -- sound-hunt: phonological awareness, multi-stage
  ('sound-hunt', 'English',
   'phonological awareness — initial sound recognition',
   'CAPS HL Gr R p.34; CAPS HL Gr 1 p.56',
   'identifies the target sound across saying, finding and reading stages',
   'other'),

  -- sound-sorter: phoneme-grapheme mapping
  ('sound-sorter', 'English',
   'phoneme-grapheme correspondence — initial sounds',
   'CAPS HL Gr 1 p.56',
   'correctly matches a pictured word to its initial phoneme in a two-choice selection',
   'other'),

  -- blend-a-word: phoneme blending
  ('blend-a-word', 'English',
   'phoneme blending — CVC words',
   'CAPS HL Gr 1 p.56',
   'blends individually tapped phoneme sounds into a recognisable CVC word',
   'other'),

  -- add-numbers: addition, number line
  ('add-numbers', 'Mathematics',
   'addition — counting on using a number line',
   'CAPS Maths Gr 1 p.22',
   'hops along a number line to solve a single-digit addition problem',
   'number_line'),

  -- bead-string: one-to-one correspondence
  ('bead-string', 'Mathematics',
   'counting — one-to-one correspondence',
   'CAPS Maths Gr R p.10; CAPS Maths Gr 1 p.12',
   'slides and counts individual beads to reach a target number with one-to-one correspondence',
   'counters'),

  -- make-a-ten: number bonds, bridging through 10
  ('make-a-ten', 'Mathematics',
   'number bonds to 10 — bridging through 10',
   'CAPS Maths Gr 1 p.22',
   'fills a ten-frame by adding counters from a tray to make exactly 10',
   'building_up'),

  -- group-of-5: skip counting, grouping
  ('group-of-5', 'Mathematics',
   'skip counting in fives — grouping and repeated addition',
   'CAPS Maths Gr 2 p.16',
   'counts groups of 5 dots by tapping each row and accumulating the running total',
   'pictures')

ON CONFLICT DO NOTHING;

COMMIT;
