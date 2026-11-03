-- Migration 006: seed Teacher and HOD users with known UUIDs
-- These UUIDs are stable so approved_by, created_by, reviewed_by FKs resolve
-- from day one and in tests.

BEGIN;

-- Insert default school first (required FK for users)
INSERT INTO schools (id, name, emis_number)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'Demo School',
  'EMIS-70021144'
)
ON CONFLICT (id) DO NOTHING;

-- Teacher user
INSERT INTO users (id, name, role, school_id)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Teacher',
  'teacher',
  '00000000-0000-0000-0000-000000000010'
)
ON CONFLICT (id) DO NOTHING;

-- HOD user
INSERT INTO users (id, name, role, school_id)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Mrs. Khumalo (HOD)',
  'hod',
  '00000000-0000-0000-0000-000000000010'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
