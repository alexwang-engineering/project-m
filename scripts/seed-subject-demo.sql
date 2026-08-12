\set ON_ERROR_STOP on

-- Synthetic, idempotent local demo content. Run only against a disposable demo database.
do $$
declare
  teacher uuid;
  student uuid;
  current_tag uuid;
  item record;
begin
  select id into teacher from public.profiles where email = 'teacher.demo@merchanttaylors.com';
  select id into student from public.profiles where email = 'student.demo@merchanttaylors.com';
  if teacher is null or student is null then
    raise exception 'Create the synthetic teacher and student demo accounts first';
  end if;

  for item in
    select * from (values
      ('11000000-0000-4000-8000-000000000001'::uuid, 'Y9MA1', 'Year 9 Mathematics', '21000000-0000-4000-8000-000000000001'::uuid, 'maths-quadratic-equations', 'Quadratic equations',
       'A quadratic equation contains a squared term. This lesson moves from factorising to solving and checking roots.',
       array['Recognise a quadratic expression','Factorise x² + bx + c','Solve by using the zero-product rule'],
       '<strong>Core idea:</strong> if two factors multiply to zero, at least one factor must be zero. For x² + 7x + 12 = 0, factorise to (x + 3)(x + 4) = 0.',
       '<strong>Worked example:</strong> x² − x − 12 = 0 becomes (x − 4)(x + 3) = 0, so x = 4 or x = −3. Substitute both values into the original equation to check.',
       array['Solve x² + 9x + 20 = 0','Solve x² − 2x − 15 = 0','Explain why a quadratic can have two, one, or no real roots'],
       'Which pair multiplies to 20 and adds to 9?',
       'Maths: Quadratic equations practice',
       'For x² + 5x + 6 = 0, which factorisation is correct?',
       '[{"id":"a","label":"(x + 2)(x + 3)"},{"id":"b","label":"(x + 1)(x + 6)"},{"id":"c","label":"(x - 2)(x - 3)"}]'::jsonb, 'a',
       'What are the roots of x² − 9 = 0?',
       '[{"id":"a","label":"3 only"},{"id":"b","label":"−3 only"},{"id":"c","label":"3 and −3"}]'::jsonb, 'c'),
      ('11000000-0000-4000-8000-000000000002'::uuid, 'Y9EN1', 'Year 9 English', '21000000-0000-4000-8000-000000000002'::uuid, 'english-persuasive-writing', 'Persuasive writing',
       'Explore how writers shape an argument for a specific audience through structure, evidence and deliberate language choices.',
       array['Identify ethos, pathos and logos','Build a coherent line of argument','Use evidence and counterargument effectively'],
       '<strong>Core idea:</strong> persuasion is more than emotive vocabulary. A convincing argument establishes credibility, selects relevant evidence and anticipates objections.',
       '<strong>Model:</strong> “Although some argue that homework builds independence, evidence about workload suggests that quality matters more than quantity.” The concession makes the claim sound measured.',
       array['Write a precise thesis on school uniform','Add one evidence-led paragraph','Write and rebut a credible counterargument'],
       'Does every paragraph clearly advance the central claim?',
       'English: Persuasive speech',
       'Which technique appeals primarily to logic?',
       '[{"id":"a","label":"A verified statistic"},{"id":"b","label":"A vivid sad image"},{"id":"c","label":"A celebrity endorsement"}]'::jsonb, 'a',
       'What is the purpose of a counterargument?',
       '[{"id":"a","label":"To change topic"},{"id":"b","label":"To address an opposing view"},{"id":"c","label":"To repeat the introduction"}]'::jsonb, 'b'),
      ('11000000-0000-4000-8000-000000000003'::uuid, 'Y9HI1', 'Year 9 History', '21000000-0000-4000-8000-000000000003'::uuid, 'history-industrial-revolution', 'The Industrial Revolution',
       'Investigate why industrialisation began in Britain and judge how far it transformed life between 1750 and 1900.',
       array['Explain key causes of industrialisation','Use primary sources critically','Reach a balanced judgement about change'],
       '<strong>Core idea:</strong> industrialisation resulted from connected causes: coal and iron, capital, inventions, transport, empire and population growth. No single cause works alone.',
       '<strong>Source method:</strong> ask who produced a source, when, for whom and why. A factory owner and a child worker may describe the same mill very differently.',
       array['Rank the six causes by importance','Analyse a factory testimony for provenance','Judge whether living standards improved by 1900'],
       'What evidence would make a claim about living standards more reliable?',
       'History: Industrialisation enquiry',
       'Which fuel powered most early steam engines?',
       '[{"id":"a","label":"Coal"},{"id":"b","label":"Oil"},{"id":"c","label":"Uranium"}]'::jsonb, 'a',
       'Why should historians compare sources?',
       '[{"id":"a","label":"To remove all disagreement"},{"id":"b","label":"To test claims against different perspectives"},{"id":"c","label":"To find the longest account"}]'::jsonb, 'b'),
      ('11000000-0000-4000-8000-000000000004'::uuid, 'Y9GE1', 'Year 9 Geography', '21000000-0000-4000-8000-000000000004'::uuid, 'geography-river-landscapes', 'River landscapes',
       'Follow a drainage basin from source to mouth and explain how erosion, transport and deposition create distinctive landforms.',
       array['Use drainage-basin vocabulary accurately','Explain erosion and deposition','Interpret a river long profile'],
       '<strong>Core idea:</strong> river energy changes downstream. Hydraulic action and abrasion erode; traction, saltation, suspension and solution transport load; deposition occurs when energy falls.',
       '<strong>Landform sequence:</strong> a waterfall forms where resistant rock overlies softer rock. Undercutting creates an overhang, collapse follows, and retreat leaves a gorge.',
       array['Annotate a drainage-basin diagram','Explain waterfall retreat as a sequence','Use evidence to assess local flood risk'],
       'Where in the explanation does river energy increase or decrease?',
       'Geography: River processes fieldwork',
       'Which process moves large stones along the river bed?',
       '[{"id":"a","label":"Suspension"},{"id":"b","label":"Traction"},{"id":"c","label":"Solution"}]'::jsonb, 'b',
       'Why does deposition occur?',
       '[{"id":"a","label":"The river loses energy"},{"id":"b","label":"The channel always narrows"},{"id":"c","label":"Rainfall stops permanently"}]'::jsonb, 'a'),
      ('11000000-0000-4000-8000-000000000005'::uuid, 'Y9CH1', 'Year 9 Chemistry', '21000000-0000-4000-8000-000000000005'::uuid, 'chemistry-atomic-structure', 'Atomic structure',
       'Build a particle model of the atom and use atomic and mass numbers to determine subatomic particles and isotopes.',
       array['Describe protons, neutrons and electrons','Calculate particle numbers','Explain what makes atoms isotopes'],
       '<strong>Core idea:</strong> atomic number equals proton number. In a neutral atom it also equals electron number. Mass number equals protons plus neutrons.',
       '<strong>Worked example:</strong> sodium-23 has atomic number 11: 11 protons, 11 electrons and 23 − 11 = 12 neutrons.',
       array['Complete particle counts for carbon-12','Compare carbon-12 and carbon-14','Explain ion formation using electron transfer'],
       'Have you used mass number and atomic number for different purposes?',
       'Chemistry: Atomic structure check',
       'How many neutrons are in magnesium-24 (atomic number 12)?',
       '[{"id":"a","label":"12"},{"id":"b","label":"24"},{"id":"c","label":"36"}]'::jsonb, 'a',
       'Which particles determine the element?',
       '[{"id":"a","label":"Neutrons"},{"id":"b","label":"Protons"},{"id":"c","label":"Electron shells"}]'::jsonb, 'b'),
      ('11000000-0000-4000-8000-000000000006'::uuid, 'Y9BI1', 'Year 9 Biology', '21000000-0000-4000-8000-000000000006'::uuid, 'biology-cell-division', 'Cell division and growth',
       'Connect the cell cycle, mitosis and differentiation to growth, repair and the production of specialised cells.',
       array['Outline the cell cycle','Explain why mitosis produces identical cells','Relate differentiation to function'],
       '<strong>Core idea:</strong> before mitosis, DNA replicates. Chromosomes are separated and the cell divides, producing two genetically identical daughter cells.',
       '<strong>Application:</strong> skin repair requires controlled cell division. Uncontrolled division can form a tumour, showing why cell-cycle regulation matters.',
       array['Sequence the stages of the cell cycle','Compare mitosis with differentiation','Explain how a root hair cell is adapted'],
       'Why must DNA be copied before a cell divides?',
       'Biology: Cell division review',
       'What does mitosis normally produce?',
       '[{"id":"a","label":"Two genetically identical cells"},{"id":"b","label":"Four different cells"},{"id":"c","label":"One cell with no DNA"}]'::jsonb, 'a',
       'What is differentiation?',
       '[{"id":"a","label":"Cells becoming specialised"},{"id":"b","label":"DNA leaving the nucleus"},{"id":"c","label":"All cells dividing constantly"}]'::jsonb, 'a'),
      ('11000000-0000-4000-8000-000000000007'::uuid, 'Y9PH1', 'Year 9 Physics', '21000000-0000-4000-8000-000000000007'::uuid, 'physics-forces-motion', 'Forces and motion',
       'Use resultant force and Newton’s laws to explain changes in motion and solve force, mass and acceleration problems.',
       array['Draw force diagrams','Calculate resultant force','Use F = ma with correct units'],
       '<strong>Core idea:</strong> balanced forces give zero resultant force and no acceleration. An unbalanced resultant force changes velocity.',
       '<strong>Worked example:</strong> a 5 kg trolley experiences a resultant force of 15 N. a = F ÷ m = 15 ÷ 5 = 3 m/s².',
       array['Draw forces on a falling object','Calculate acceleration for three examples','Explain terminal velocity'],
       'Have you distinguished velocity from acceleration?',
       'Physics: Forces calculation',
       'A 20 N force acts on a 4 kg mass. What is its acceleration?',
       '[{"id":"a","label":"5 m/s²"},{"id":"b","label":"80 m/s²"},{"id":"c","label":"0.2 m/s²"}]'::jsonb, 'a',
       'Balanced forces mean the resultant force is…',
       '[{"id":"a","label":"Maximum"},{"id":"b","label":"Zero"},{"id":"c","label":"Always downward"}]'::jsonb, 'b'),
      ('11000000-0000-4000-8000-000000000008'::uuid, 'Y9FR1', 'Year 9 French', '21000000-0000-4000-8000-000000000008'::uuid, 'french-perfect-tense', 'Le passé composé',
       'Use the perfect tense to describe completed past events with accurate auxiliaries, past participles and time phrases.',
       array['Choose avoir or être','Form common past participles','Build an extended account of a past weekend'],
       '<strong>Structure:</strong> subject + present tense of avoir/être + past participle. Example: “J’ai regardé un film.” Movement verbs with être agree with the subject.',
       '<strong>Model:</strong> “Samedi, je suis allé au centre-ville avec mes amis. Nous avons mangé au café, puis j’ai acheté un livre.”',
       array['Conjugate three avoir verbs','Write two être sentences with agreement','Add opinions and sequencing phrases'],
       'Have you checked both the auxiliary and the past participle?',
       'French: Perfect tense account',
       'Complete: Hier, nous ___ joué au tennis.',
       '[{"id":"a","label":"avons"},{"id":"b","label":"sommes"},{"id":"c","label":"avez"}]'::jsonb, 'a',
       'Which is correct for a female speaker?',
       '[{"id":"a","label":"Je suis allé"},{"id":"b","label":"Je suis allée"},{"id":"c","label":"J’ai allée"}]'::jsonb, 'b'),
      ('11000000-0000-4000-8000-000000000009'::uuid, 'Y9CS1', 'Year 9 Computer Science', '21000000-0000-4000-8000-000000000009'::uuid, 'computer-science-algorithms', 'Algorithms and searching',
       'Compare linear and binary search, trace algorithms accurately and select an approach from the structure of the data.',
       array['Trace a search algorithm','Explain the need for sorted input','Compare algorithm efficiency'],
       '<strong>Core idea:</strong> linear search checks items in sequence. Binary search repeatedly halves a sorted search space, so it scales much better for large lists.',
       '<strong>Trace:</strong> to find 31 in [4, 12, 19, 31, 45], compare with 19, discard the lower half, then compare with 31.',
       array['Trace both searches on the same list','State each algorithm’s preconditions','Explain which you would use for 10,000 sorted records'],
       'Does the chosen algorithm require the data to be sorted?',
       'Computer Science: Search algorithms',
       'Which search requires sorted data?',
       '[{"id":"a","label":"Linear search"},{"id":"b","label":"Binary search"},{"id":"c","label":"Neither"}]'::jsonb, 'b',
       'What does binary search do after each comparison?',
       '[{"id":"a","label":"Halves the remaining search space"},{"id":"b","label":"Shuffles the list"},{"id":"c","label":"Checks every earlier item"}]'::jsonb, 'a')
    ) as v(tag_id, tag_name, display_name, page_id, slug, title, overview, objectives, explanation, worked, tasks, check_prompt, assignment_title, q1, q1_choices, q1_answer, q2, q2_choices, q2_answer)
  loop
    select id into current_tag from public.tags where upper(tag_name) = item.tag_name;
    if current_tag is null then
      current_tag := item.tag_id;
      insert into public.tags (id, tag_name, display_name, created_by)
      values (current_tag, item.tag_name, item.display_name, teacher);
    else
      update public.tags set display_name = item.display_name, is_active = true, archived_at = null where id = current_tag;
    end if;

    if not exists (select 1 from public.tag_memberships where profile_id = teacher and tag_id = current_tag and membership_role = 'teacher' and valid_until is null) then
      insert into public.tag_memberships (profile_id, tag_id, membership_role, source, reason, granted_by)
      values (teacher, current_tag, 'teacher', 'demo-seed', 'Synthetic subject demo', teacher);
    end if;
    if not exists (select 1 from public.tag_memberships where profile_id = student and tag_id = current_tag and membership_role = 'member' and valid_until is null) then
      insert into public.tag_memberships (profile_id, tag_id, membership_role, source, reason, granted_by)
      values (student, current_tag, 'member', 'demo-seed', 'Synthetic subject demo', teacher);
    end if;

    insert into public.pages (id, slug, canonical_url, title, content_json, author_id, lifecycle, published_at, version)
    values (
      item.page_id, item.slug, '/' || item.slug, item.title,
      jsonb_build_object('schemaVersion', 1, 'blocks', jsonb_build_array(
        jsonb_build_object('id','overview','type','callout','tone','info','title','Lesson overview','html',item.overview),
        jsonb_build_object('id','objectives','type','heading','level',2,'html','Learning objectives'),
        jsonb_build_object('id','objective-list','type','list','ordered',false,'items',to_jsonb(item.objectives)),
        jsonb_build_object('id','explanation','type','paragraph','html',item.explanation),
        jsonb_build_object('id','worked-example','type','callout','tone','neutral','title','Worked example','html',item.worked),
        jsonb_build_object('id','independent-practice','type','heading','level',2,'html','Independent practice'),
        jsonb_build_object('id','task-list','type','list','ordered',true,'items',to_jsonb(item.tasks)),
        jsonb_build_object('id','check','type','callout','tone','warning','title','Self-check','html',item.check_prompt)
      )), teacher, 'published', now(), 1
    )
    on conflict (id) do update set title = excluded.title, content_json = excluded.content_json, lifecycle = 'published', published_at = coalesce(public.pages.published_at, now()), archived_at = null, updated_at = now();
    insert into public.page_tags (page_id, tag_id, added_by) values (item.page_id, current_tag, teacher) on conflict do nothing;

    insert into public.assignments (id, title, instructions_page_id, due_at, allow_resubmission, created_by, lifecycle, published_at)
    values ((item.page_id::text::uuid::text || '')::uuid, item.assignment_title, item.page_id, now() + interval '14 days', true, teacher, 'published', now())
    on conflict (id) do update set title = excluded.title, instructions_page_id = excluded.instructions_page_id, due_at = excluded.due_at, lifecycle = 'published', published_at = coalesce(public.assignments.published_at, now()), archived_at = null;
    insert into public.assignment_tags (assignment_id, tag_id, added_by) values (item.page_id, current_tag, teacher) on conflict do nothing;

    insert into public.quizzes (id, title, due_at, author_id)
    values (('41000000-0000-4000-8000-' || right(item.tag_id::text, 12))::uuid, item.title || ': knowledge check', now() + interval '10 days', teacher)
    on conflict (id) do update set title = excluded.title, due_at = excluded.due_at, archived_at = null;
    insert into public.quiz_tags (quiz_id, tag_id, added_by)
    values (('41000000-0000-4000-8000-' || right(item.tag_id::text, 12))::uuid, current_tag, teacher) on conflict do nothing;

    delete from public.quiz_questions where quiz_id = ('41000000-0000-4000-8000-' || right(item.tag_id::text, 12))::uuid;
    insert into public.quiz_questions (id, quiz_id, position, prompt, choices) values
      (('51000000-0000-4000-8001-' || right(item.tag_id::text, 12))::uuid, ('41000000-0000-4000-8000-' || right(item.tag_id::text, 12))::uuid, 1, item.q1, item.q1_choices),
      (('51000000-0000-4000-8002-' || right(item.tag_id::text, 12))::uuid, ('41000000-0000-4000-8000-' || right(item.tag_id::text, 12))::uuid, 2, item.q2, item.q2_choices);
    insert into public.quiz_answer_keys (question_id, correct_choice_id) values
      (('51000000-0000-4000-8001-' || right(item.tag_id::text, 12))::uuid, item.q1_answer),
      (('51000000-0000-4000-8002-' || right(item.tag_id::text, 12))::uuid, item.q2_answer);
  end loop;
end
$$;
