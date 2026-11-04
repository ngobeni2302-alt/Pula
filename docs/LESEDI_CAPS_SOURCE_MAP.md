# Lesedi CAPS Source Map

This document consolidates every CAPS (Curriculum Assessment Policy Statements) reference used across the Lesedi AI Agent. Each reference is traceable to the file and line where it appears.

## Source Documents

| Abbreviation | Full Title | Publisher |
|---|---|---|
| CAPS HL | Curriculum and Assessment Policy Statement: Home Language (Grades R–3) | Department of Basic Education, South Africa |
| CAPS Maths | Curriculum and Assessment Policy Statement: Mathematics (Grades R–3) | Department of Basic Education, South Africa |

All page references are to the official DBE CAPS documents. Where a reference cites a range (e.g. p.34), it refers to the relevant section on that page or spanning that page range.

---

## Literacy (Home Language) References

### Phonological Awareness and Phonics

| CAPS Reference | Context | File |
|---|---|---|
| CAPS HL Gr R p.34 | Beginning sounds of own name; phonological awareness | `tierRules.js` — Seed tier literacy rule |
| CAPS HL Gr R p.34 | Initial sound recognition | `007_seed_activities.sql` — Sound Hunt activity |
| CAPS HL Gr 1 p.56 | Letter-sound matching, phonics | `tierRules.js` — Seed tier literacy rule; `007_seed_activities.sql` — Sound Sorter activity |
| CAPS HL Gr 1 p.56 | Blending, segmenting CVC words | `tierRules.js` — Sprout tier literacy rule; `007_seed_activities.sql` — Blend a Word activity |
| CAPS HL Gr 1 p.56–57 | Blending, segmenting, sight words | `tierRules.js` — Sprout tier literacy rule |
| CAPS HL Gr 1 p.57 | Same-ability groups at 90–95% word accuracy | `guardrails.js` — `no_reading_groups_without_evidence` policy |
| CAPS HL Gr 2 p.81 | Word families | `tierRules.js` — Sprout tier literacy rule |
| CAPS HL Gr 2 p.82 | Instructional level 90–95% | `tierRules.js` — Bloom tier literacy rule |
| CAPS HL Gr 3 p.107 | Higher-order questions | `tierRules.js` — Bloom tier literacy rule |
| CAPS HL Gr 3 p.107–109 | Higher-order comprehension; extended writing | `tierRules.js` — Tree tier literacy rule |

### Oral Language

| CAPS Reference | Context | File |
|---|---|---|
| CAPS HL Gr R p.20–21 | Oral language, listening and speaking | `007_seed_activities.sql` — Talk & Turn activity |
| CAPS HL Gr 1 p.55 | Answers questions, takes part | `007_seed_activities.sql` — Talk & Turn activity |

### Grade R Assessment

| CAPS Reference | Context | File |
|---|---|---|
| CAPS HL Gr R p.21 | Grade R assessment is informal and not a test situation | `guardrails.js` — `grade_r_no_test` policy |
| Teacher's Guide p.11 | Grade R assessment guidance | `guardrails.js` — `grade_r_no_test` policy |

### Progression Gates

| CAPS Reference | Context | File |
|---|---|---|
| CAPS HL Gr R p.21 | Grade R → Grade 1 progression gate | `tierRules.js` — `PROGRESSION_GATES.R_to_1` |
| CAPS HL Gr 1 p.57 | Grade 1 → Grade 2 progression gate | `tierRules.js` — `PROGRESSION_GATES.1_to_2` |
| CAPS HL Gr 2 p.82 | Grade 2 → Grade 3 progression gate | `tierRules.js` — `PROGRESSION_GATES.2_to_3` |
| CAPS HL Gr 3 p.107–109 | Grade 3 enrichment context | `tierRules.js` — `formatGate('3')` |

---

## Mathematics References

### Counting and Number Sense

| CAPS Reference | Context | File |
|---|---|---|
| CAPS Maths Gr R p.7 | Assessment is informal and observational | `guardrails.js` — `no_maths_test_grade_r` policy |
| CAPS Maths Gr R p.10 | Count to 5; one-to-one correspondence | `tierRules.js` — Seed tier maths rule; `007_seed_activities.sql` — Bead String activity |
| CAPS Maths Gr 1 p.12 | Counting to 20 | `tierRules.js` — Seed tier maths rule; `007_seed_activities.sql` — Bead String activity |
| CAPS Maths Gr 1 p.22 | Addition within 10; number line; number bonds to 10 | `tierRules.js` — Sprout maths rule; `007_seed_activities.sql` — Add Numbers and Make a Ten activities |
| CAPS Maths Gr 1 p.22 | Bridging through 10 | `tierRules.js` — Sprout maths rule |

### Two-Digit Operations and Place Value

| CAPS Reference | Context | File |
|---|---|---|
| CAPS Maths Gr 2 p.16 | Single-digit operations; grouping, repeated addition, skip counting in fives | `tierRules.js` — Seed maths rule; `007_seed_activities.sql` — Group of 5 activity |
| CAPS Maths Gr 2 p.38 | Two-digit operations | `tierRules.js` — Sprout maths rule |
| CAPS Maths Gr 2 p.40 | Mental maths strategies | `tierRules.js` — Bloom maths rule |
| CAPS Maths Gr 3 p.24 | Place value HTU | `tierRules.js` — Bloom maths rule |
| CAPS Maths Gr 3 p.28 | Multi-step problems | `tierRules.js` — Tree maths rule |
| CAPS Maths Gr 3 p.32 | Patterns and relationships | `tierRules.js` — Tree maths rule |

### Progression Gates

| CAPS Reference | Context | File |
|---|---|---|
| CAPS Maths Gr R p.7 | Grade R → Grade 1 progression gate (maths) | `tierRules.js` — `PROGRESSION_GATES.R_to_1` |
| CAPS Maths Gr 1 p.22 | Grade 1 → Grade 2 progression gate (maths) | `tierRules.js` — `PROGRESSION_GATES.1_to_2` |
| CAPS Maths Gr 2 p.40 | Grade 2 → Grade 3 progression gate (maths) | `tierRules.js` — `PROGRESSION_GATES.2_to_3` |

---

## Activity Catalog References

The 5 core digital activities (from `shared/activityCatalog.js`) map to CAPS as follows:

| Activity | Subject | CAPS Coverage | Seeded in Migration |
|---|---|---|---|
| Reading Time | English | CAPS HL Gr R–3 (oral reading fluency, comprehension) | Not yet (participation only — no validated score) |
| Number Hunt | Mathematics | CAPS Maths Gr 1 p.12 (number recognition 1–10) | Not yet (mapped to add-numbers skill) |
| Count and Pick | Mathematics | CAPS Maths Gr R p.10 (one-to-one correspondence) | Not yet (mapped to bead-string skill) |
| Rhyme Time | English | CAPS HL Gr 1 p.56 (phonological awareness, rhyming) | Not yet (mapped to sound-sorter skill) |
| Sound It Out | English | CAPS HL Gr 1 p.56 (blending, segmenting CVC) | Not yet (mapped to blend-a-word skill) |

The 8 legacy activities (from `frontend/src/activities/activitiesData.js`) are seeded in migration 007 and have explicit CAPS references in the `activity_skill_map` table.

---

## HOD Alert Thresholds (Project Rules — Not CAPS)

These thresholds are internal Pula project rules, not CAPS requirements:

| Threshold | Value | File |
|---|---|---|
| Seed critical weeks | 4 | `tierRules.js` — `HOD_ALERTS.seed_critical_weeks` |
| Stagnation weeks | 6 | `tierRules.js` — `HOD_ALERTS.stagnation_weeks` |
| No consent max weeks | 2 | `tierRules.js` — `HOD_ALERTS.no_consent_max_weeks` |

---

## Policy Source Tags

Every guardrail policy is source-tagged for auditability:

| Source Tag | Meaning |
|---|---|
| CAPS | Direct CAPS curriculum requirement with page reference |
| POPIA | South African Protection of Personal Information Act |
| PROJECT | Internal Pula project rule (agreed by teachers and HODs) |
| PEDAGOGY | Sound teaching principle (not from a single document) |

---

## Validation Checklist

- [x] Every tier rule has a CAPS reference for both literacy and maths
- [x] Every progression gate has a CAPS reference
- [x] Every activity in migration 007 has a CAPS reference
- [x] Every `activity_skill_map` row has a CAPS reference
- [x] Every guardrail policy that cites CAPS has a page reference
- [x] Grade 3 has enrichment context (not an empty string)
- [x] HOD alert thresholds are clearly marked as project rules, not CAPS
