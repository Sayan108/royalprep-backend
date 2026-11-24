ALTER TABLE questions DROP CONSTRAINT questions_options_check;
ALTER TABLE questions DROP CONSTRAINT questions_correct_check;
ALTER TABLE questions ADD CONSTRAINT questions_options_check
  CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 4 AND 5);
ALTER TABLE questions ADD CONSTRAINT questions_correct_check
  CHECK (correct >= 0 AND correct < jsonb_array_length(options));

ALTER TABLE student_practice_answers DROP CONSTRAINT student_practice_answers_selected_option_check;
ALTER TABLE student_practice_answers DROP CONSTRAINT student_practice_answers_correct_option_check;
ALTER TABLE student_practice_answers ADD CONSTRAINT student_practice_answers_selected_option_check
  CHECK (selected_option BETWEEN 0 AND 4);
ALTER TABLE student_practice_answers ADD CONSTRAINT student_practice_answers_correct_option_check
  CHECK (correct_option BETWEEN 0 AND 4);
