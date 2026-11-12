-- Spell "practice" with a c everywhere (practise -> practice, practised -> practiced, practising -> practicing).
-- Fixes text already stored: questions, lessons, skill names and saved tutor explanations.
UPDATE "Question" SET
  prompt      = replace(replace(prompt,      'Practis', 'Practic'), 'practis', 'practic'),
  correct     = replace(replace(correct,     'Practis', 'Practic'), 'practis', 'practic'),
  wrong1      = replace(replace(wrong1,      'Practis', 'Practic'), 'practis', 'practic'),
  wrong2      = replace(replace(wrong2,      'Practis', 'Practic'), 'practis', 'practic'),
  wrong3      = replace(replace(wrong3,      'Practis', 'Practic'), 'practis', 'practic'),
  explanation = replace(replace(explanation, 'Practis', 'Practic'), 'practis', 'practic'),
  skill       = replace(replace(skill,       'Practis', 'Practic'), 'practis', 'practic'),
  strand      = replace(replace(strand,      'Practis', 'Practic'), 'practis', 'practic')
WHERE concat(prompt, correct, wrong1, wrong2, wrong3, explanation, skill, strand) ILIKE '%practis%';

UPDATE "Lesson" SET
  content = replace(replace(content::text, 'Practis', 'Practic'), 'practis', 'practic')::jsonb,
  skill   = replace(replace(skill, 'Practis', 'Practic'), 'practis', 'practic')
WHERE content::text ILIKE '%practis%' OR skill ILIKE '%practis%';

UPDATE "SkillProgress"   SET skill = replace(replace(skill, 'Practis', 'Practic'), 'practis', 'practic') WHERE skill ILIKE '%practis%';
UPDATE "PracticeSession" SET skill = replace(replace(skill, 'Practis', 'Practic'), 'practis', 'practic') WHERE skill ILIKE '%practis%';
UPDATE "Assignment"      SET skill = replace(replace(skill, 'Practis', 'Practic'), 'practis', 'practic'),
                             note  = replace(replace(note,  'Practis', 'Practic'), 'practis', 'practic')
WHERE skill ILIKE '%practis%' OR note ILIKE '%practis%';
UPDATE "TutorExplanation" SET text = replace(replace(text, 'Practis', 'Practic'), 'practis', 'practic') WHERE text ILIKE '%practis%';
