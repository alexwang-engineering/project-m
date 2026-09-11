'use client';

import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  FileQuestion,
  FileText,
  Folder,
  FolderOpen,
  GripVertical,
  Image,
  Link2,
  ListChecks,
  MoreHorizontal,
  PanelLeft,
  Plus,
  Search,
  Settings2,
  Sparkles,
  Table2,
  Upload,
  Video,
} from 'lucide-react';
import { useState } from 'react';

type View = 'explorer' | 'resources' | 'page' | 'quiz';

const views: { id: View; label: string }[] = [
  { id: 'explorer', label: 'File explorer' },
  { id: 'resources', label: 'Resources' },
  { id: 'page', label: 'Page editor' },
  { id: 'quiz', label: 'Quiz editor' },
];

const resources = [
  {
    title: 'Quadratic equations',
    type: 'Topic',
    meta: '6 sections',
    icon: FileText,
  },
  {
    title: 'Algebra checkpoint',
    type: 'Quiz',
    meta: '10 questions',
    icon: FileQuestion,
  },
  { title: 'Revision workbook', type: 'PDF', meta: '2.4 MB', icon: BookOpen },
  {
    title: 'Completing the square',
    type: 'Topic',
    meta: '4 sections',
    icon: FileText,
  },
];

const rows = [
  {
    name: 'Quadratic equations',
    type: 'Page',
    updated: 'Today, 09:42',
    status: 'Published',
  },
  {
    name: 'Algebra checkpoint',
    type: 'Quiz',
    updated: 'Yesterday',
    status: 'Draft',
  },
  {
    name: 'Revision workbook.pdf',
    type: 'PDF',
    updated: '4 Sep',
    status: 'Published',
  },
  {
    name: 'Completing the square',
    type: 'Page',
    updated: '2 Sep',
    status: 'Published',
  },
];

const blocks = [
  { label: 'Text', icon: FileText },
  { label: 'Image', icon: Image },
  { label: 'Video', icon: Video },
  { label: 'Link', icon: Link2 },
  { label: 'Table', icon: Table2 },
  { label: 'Quiz', icon: ListChecks },
];

function ActionButton({
  children,
  primary = false,
  onClick,
}: {
  children: React.ReactNode;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-3.5 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#254889] ${
        primary
          ? 'bg-[#254889] text-white hover:bg-[#1d3970]'
          : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

function Explorer() {
  const [folder, setFolder] = useState('GCSE Mathematics');
  const [selected, setSelected] = useState('Quadratic equations');
  const [query, setQuery] = useState('');
  const filtered = rows.filter((row) =>
    row.name.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="grid min-h-[690px] lg:grid-cols-[230px_minmax(0,1fr)_250px]">
      <aside className="border-b border-slate-200 bg-slate-50/80 p-4 lg:border-r lg:border-b-0">
        <p className="mb-3 px-2 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">
          Library
        </p>
        {['Academic', 'Careers', 'University applications', 'Other'].map(
          (item, index) => (
            <button
              key={item}
              type="button"
              className="flex w-full items-center gap-2 rounded-[10px] px-2.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-white"
            >
              {index === 0 ? (
                <FolderOpen size={16} className="text-[#254889]" />
              ) : (
                <Folder size={16} />
              )}
              {item}
            </button>
          ),
        )}
        <div className="mt-2 ml-6 space-y-1 border-l border-slate-200 pl-3">
          {['Mathematics', 'English', 'Chemistry', 'History', 'Geography'].map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  setFolder(item === 'Mathematics' ? 'GCSE Mathematics' : item)
                }
                className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-xs text-slate-600 hover:bg-white hover:text-slate-950"
              >
                <ChevronRight size={13} /> {item}
              </button>
            ),
          )}
        </div>
      </aside>

      <section className="min-w-0 p-5 sm:p-7">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Academic / Mathematics / GCSE
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              {folder}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <ActionButton>
              <Folder size={16} /> New folder
            </ActionButton>
            <ActionButton primary>
              <Upload size={16} /> Upload
            </ActionButton>
          </div>
        </div>
        <label className="relative mt-5 block">
          <Search className="absolute top-3 left-3 text-slate-400" size={16} />
          <span className="sr-only">Search this folder</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this folder"
            className="w-full rounded-[10px] border border-slate-200 bg-white py-2.5 pr-3 pl-9 text-sm outline-none focus:border-[#254889]"
          />
        </label>
        <div className="mt-5 overflow-x-auto rounded-[14px] border border-slate-200">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Visibility</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row) => (
                <tr
                  key={row.name}
                  onClick={() => setSelected(row.name)}
                  className={`cursor-pointer ${selected === row.name ? 'bg-blue-50/70' : 'hover:bg-slate-50'}`}
                >
                  <th className="px-4 py-3.5 font-semibold text-slate-900">
                    <span className="flex items-center gap-2">
                      <FileText size={16} className="text-[#254889]" />
                      {row.name}
                    </span>
                  </th>
                  <td className="px-4 py-3.5 text-slate-600">{row.type}</td>
                  <td className="px-4 py-3.5 text-slate-600">{row.updated}</td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${row.status === 'Published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3">
                    <button
                      type="button"
                      aria-label={`More actions for ${row.name}`}
                      className="rounded-lg p-2 text-slate-500 hover:bg-white"
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="border-t border-slate-200 bg-slate-50/70 p-5 lg:border-t-0 lg:border-l">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">
            Details
          </p>
          <Settings2 size={16} className="text-slate-400" />
        </div>
        <div className="mt-5 flex h-10 w-10 items-center justify-center rounded-[10px] bg-blue-50 text-[#254889]">
          <FileText size={19} />
        </div>
        <h3 className="mt-3 font-bold text-slate-950">{selected}</h3>
        <p className="mt-1 text-xs text-slate-500">Canonical page resource</p>
        <dl className="mt-6 space-y-4 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Assigned tags</dt>
            <dd className="mt-1 font-semibold text-slate-800">
              Y11MA1, Y11MA2
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Version</dt>
            <dd className="mt-1 font-semibold text-slate-800">12, published</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Owner</dt>
            <dd className="mt-1 font-semibold text-slate-800">A. Teacher</dd>
          </div>
        </dl>
        <div className="mt-6 grid gap-2">
          <ActionButton>
            <Eye size={15} /> Preview
          </ActionButton>
          <ActionButton>
            <Copy size={15} /> Duplicate
          </ActionButton>
        </div>
      </aside>
    </div>
  );
}

function Resources() {
  const [section, setSection] = useState('Academic');
  return (
    <div className="min-h-[690px] p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Home / Resources / {section}
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Resources
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Find the topics, quizzes and files assigned to your classes.
            </p>
          </div>
          <label className="relative block sm:w-72">
            <Search
              className="absolute top-3 left-3 text-slate-400"
              size={16}
            />
            <span className="sr-only">Search resources</span>
            <input
              placeholder="Search resources"
              className="w-full rounded-[10px] border border-slate-200 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-[#254889]"
            />
          </label>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['Academic', 'Careers', 'University applications', 'Other'].map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSection(item)}
                className={`flex items-center justify-between rounded-[14px] border p-4 text-left transition ${section === item ? 'border-[#254889] bg-[#254889] text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300'}`}
              >
                <span>
                  <span className="block text-xs opacity-70">Collection</span>
                  <span className="mt-1 block font-bold">{item}</span>
                </span>
                <ChevronRight size={18} />
              </button>
            ),
          )}
        </div>
        <div className="mt-10 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-[#254889] uppercase">
              Y11 Mathematics
            </p>
            <h3 className="mt-1 text-xl font-bold text-slate-950">Algebra</h3>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-[#254889]"
          >
            View all
          </button>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map(({ title, type, meta, icon: Icon }, index) => (
            <button
              key={title}
              type="button"
              className="group min-h-52 rounded-[14px] border border-slate-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#254889] hover:shadow-lg hover:shadow-slate-200/60"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-blue-50 text-[#254889]">
                <Icon size={19} />
              </span>
              <span className="mt-8 block text-xs font-bold tracking-wide text-slate-500 uppercase">
                {type}
              </span>
              <span className="mt-1 block text-base font-bold text-slate-950">
                {title}
              </span>
              <span className="mt-2 block text-xs text-slate-500">
                {meta} · Updated {index + 2} days ago
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageEditor() {
  const [selectedBlock, setSelectedBlock] = useState('Key idea');
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState(false);
  return (
    <div className="min-h-[690px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            GCSE Mathematics / Algebra
          </p>
          <p className="font-bold text-slate-950">
            Quadratic equations{' '}
            <span className="ml-2 rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              Draft
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={() => setPreview(!preview)}>
            <Eye size={16} /> {preview ? 'Edit' : 'Preview'}
          </ActionButton>
          <ActionButton primary>Publish</ActionButton>
        </div>
      </div>
      <div className="grid lg:grid-cols-[190px_minmax(0,1fr)_250px]">
        <aside className="hidden border-r border-slate-200 bg-slate-50/70 p-4 lg:block">
          <p className="px-2 text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">
            Page blocks
          </p>
          {[
            'Introduction',
            'Key idea',
            'Worked example',
            'Practice',
            'Knowledge check',
          ].map((item, i) => (
            <button
              key={item}
              type="button"
              onClick={() => setSelectedBlock(item)}
              className={`mt-2 flex w-full items-center gap-2 rounded-[10px] px-2 py-2 text-left text-xs font-semibold ${selectedBlock === item ? 'bg-white text-[#254889] shadow-sm' : 'text-slate-600 hover:bg-white'}`}
            >
              <GripVertical size={14} />{' '}
              <span>
                {i + 1}. {item}
              </span>
            </button>
          ))}
        </aside>
        <main className="min-w-0 bg-slate-100/70 p-4 sm:p-8">
          {preview && (
            <p className="mx-auto mb-3 max-w-3xl text-xs font-bold tracking-wide text-[#254889] uppercase">
              Student preview
            </p>
          )}
          <article className="mx-auto max-w-3xl rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
            <p className="text-xs font-bold tracking-[0.14em] text-[#254889] uppercase">
              Algebra · Topic 4
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
              Quadratic equations
            </h2>
            <p className="mt-3 text-base leading-7 text-slate-600">
              Learn how quadratic equations describe curves, motion and the
              points where a graph crosses an axis.
            </p>
            <button
              type="button"
              onClick={() => setSelectedBlock('Key idea')}
              className={`mt-8 w-full rounded-[14px] border p-5 text-left ${selectedBlock === 'Key idea' ? 'border-[#254889] ring-2 ring-blue-100' : 'border-slate-200'}`}
            >
              <span className="text-xs font-bold tracking-wide text-[#254889] uppercase">
                Key idea
              </span>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                A quadratic equation can be written as ax² + bx + c = 0.
              </p>
            </button>
            <button
              type="button"
              onClick={() => setSelectedBlock('Worked example')}
              className={`mt-4 w-full rounded-[14px] border p-5 text-left ${selectedBlock === 'Worked example' ? 'border-[#254889] ring-2 ring-blue-100' : 'border-slate-200'}`}
            >
              <span className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                Worked example
              </span>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Factorise x² + 5x + 6 to get (x + 2)(x + 3). The solutions are x
                = -2 and x = -3.
              </p>
            </button>
            <div className="relative mt-5">
              <button
                type="button"
                onClick={() => setAdding(!adding)}
                className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-slate-300 py-3 text-sm font-semibold text-slate-600 hover:border-[#254889] hover:text-[#254889]"
              >
                <Plus size={16} /> Add block
              </button>
              {adding && (
                <div className="absolute top-14 right-0 left-0 z-10 grid grid-cols-2 gap-2 rounded-[14px] border border-slate-200 bg-white p-3 shadow-xl sm:grid-cols-3">
                  {blocks.map(({ label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => {
                        setSelectedBlock(label);
                        setAdding(false);
                      }}
                      className="flex items-center gap-2 rounded-[10px] p-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-[#254889]"
                    >
                      <Icon size={16} /> {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        </main>
        <aside className="border-t border-slate-200 bg-white p-5 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-2">
            <Settings2 size={16} />
            <h3 className="font-bold text-slate-950">Block settings</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">{selectedBlock}</p>
          <label className="mt-6 block text-xs font-semibold text-slate-600">
            Style
            <select className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white p-2.5 text-sm">
              <option>Standard</option>
              <option>Callout</option>
              <option>Key fact</option>
            </select>
          </label>
          <label className="mt-5 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
            Visible to students
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 accent-[#254889]"
            />
          </label>
          <label className="mt-5 block text-xs font-semibold text-slate-600">
            Alt text
            <input
              className="mt-2 w-full rounded-[10px] border border-slate-200 p-2.5 text-sm"
              placeholder="Describe media"
            />
          </label>
          <p className="mt-6 rounded-[10px] bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Access is enforced by assigned tags. Moving this page does not
            change who can edit it.
          </p>
        </aside>
      </div>
    </div>
  );
}

function QuizEditor() {
  const [question, setQuestion] = useState(0);
  const [preview, setPreview] = useState(false);
  const [choices, setChoices] = useState([
    'x = 2 and x = 3',
    'x = -2 and x = -3',
    'x = 1 and x = 6',
  ]);
  const questions = [
    'Factorising quadratics',
    'Graph intercepts',
    'Completing the square',
  ];
  return (
    <div className="min-h-[690px]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            Question bank / GCSE Mathematics
          </p>
          <p className="font-bold text-slate-950">Algebra checkpoint</p>
        </div>
        <div className="flex gap-2">
          <ActionButton onClick={() => setPreview(!preview)}>
            <Eye size={16} /> {preview ? 'Build' : 'Preview'}
          </ActionButton>
          <ActionButton primary>Publish quiz</ActionButton>
        </div>
      </div>
      <div className="grid lg:grid-cols-[230px_minmax(0,1fr)_250px]">
        <aside className="border-b border-slate-200 bg-slate-50/70 p-4 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-2">
            <p className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">
              Questions
            </p>
            <span className="text-xs text-slate-400">3</span>
          </div>
          {questions.map((item, index) => (
            <button
              key={item}
              type="button"
              onClick={() => setQuestion(index)}
              className={`mt-2 flex w-full gap-3 rounded-[10px] p-3 text-left ${question === index ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-white'}`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${question === index ? 'bg-[#254889] text-white' : 'bg-slate-200 text-slate-600'}`}
              >
                {index + 1}
              </span>
              <span>
                <span className="block text-xs font-semibold text-slate-800">
                  {item}
                </span>
                <span className="mt-1 block text-[11px] text-slate-500">
                  1 mark
                </span>
              </span>
            </button>
          ))}
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[10px] border border-dashed border-slate-300 py-2.5 text-xs font-semibold text-slate-600 hover:border-[#254889] hover:text-[#254889]"
          >
            <Plus size={14} /> Add question
          </button>
        </aside>
        <main className="min-w-0 bg-slate-100/70 p-4 sm:p-8">
          {preview && (
            <p className="mx-auto mb-3 max-w-2xl text-xs font-bold tracking-wide text-[#254889] uppercase">
              Student preview
            </p>
          )}
          <div className="mx-auto max-w-2xl rounded-[14px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-[#254889]">
                Multiple choice
              </span>
              <button
                type="button"
                className="text-xs font-semibold text-[#254889]"
              >
                Use question bank
              </button>
            </div>
            <label className="mt-6 block text-xs font-bold tracking-wide text-slate-500 uppercase">
              Question
              <input
                value={
                  question === 0
                    ? 'Solve x² + 5x + 6 = 0.'
                    : questions[question]
                }
                readOnly
                className="mt-2 w-full rounded-[10px] border border-slate-200 p-3 text-base font-semibold text-slate-950"
              />
            </label>
            <fieldset className="mt-6 space-y-3">
              <legend className="mb-3 text-xs font-bold tracking-wide text-slate-500 uppercase">
                Answer choices
              </legend>
              {choices.map((choice, index) => (
                <label
                  key={`${choice}-${index}`}
                  className="flex items-center gap-3 rounded-[10px] border border-slate-200 p-3 text-sm text-slate-700"
                >
                  <input
                    type="radio"
                    name="correct-answer"
                    defaultChecked={index === 1}
                    className="accent-[#254889]"
                  />
                  <input
                    value={choice}
                    onChange={(event) =>
                      setChoices((current) =>
                        current.map((item, i) =>
                          i === index ? event.target.value : item,
                        ),
                      )
                    }
                    className="min-w-0 flex-1 bg-transparent outline-none"
                  />
                  <span className="text-xs text-slate-400">
                    {index === 1 ? (
                      <Check size={15} className="text-emerald-600" />
                    ) : null}
                  </span>
                </label>
              ))}
            </fieldset>
            <button
              type="button"
              onClick={() =>
                setChoices((current) => [
                  ...current,
                  `Answer ${current.length + 1}`,
                ])
              }
              className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#254889]"
            >
              <Plus size={15} /> Add answer
            </button>
          </div>
        </main>
        <aside className="border-t border-slate-200 bg-white p-5 lg:border-t-0 lg:border-l">
          <div className="flex items-center gap-2">
            <Settings2 size={16} />
            <h3 className="font-bold text-slate-950">Quiz settings</h3>
          </div>
          <label className="mt-6 block text-xs font-semibold text-slate-600">
            Assigned tags
            <select className="mt-2 w-full rounded-[10px] border border-slate-200 p-2.5 text-sm">
              <option>Y11MA1 and Y11MA2</option>
            </select>
          </label>
          <label className="mt-5 block text-xs font-semibold text-slate-600">
            Attempts
            <select className="mt-2 w-full rounded-[10px] border border-slate-200 p-2.5 text-sm">
              <option>2 attempts</option>
              <option>1 attempt</option>
              <option>Unlimited</option>
            </select>
          </label>
          <label className="mt-5 block text-xs font-semibold text-slate-600">
            Gradebook result
            <select className="mt-2 w-full rounded-[10px] border border-slate-200 p-2.5 text-sm">
              <option>Highest attempt</option>
              <option>Latest attempt</option>
            </select>
          </label>
          <label className="mt-5 block text-xs font-semibold text-slate-600">
            Due date
            <input
              type="date"
              defaultValue="2026-10-16"
              className="mt-2 w-full rounded-[10px] border border-slate-200 p-2.5 text-sm"
            />
          </label>
          <div className="mt-6 rounded-[10px] bg-blue-50 p-3">
            <p className="text-xs font-bold text-[#254889]">
              Master question protected
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Publishing creates a linked copy. Editing this quiz will not
              silently change past attempts.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function ProjectMDesignPreview() {
  const [view, setView] = useState<View>('explorer');
  const currentTitle = views.find((item) => item.id === view)?.label;
  return (
    <div className="min-h-screen bg-[#eef1f5] font-sans text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#254889] font-bold text-white">
              M
            </span>
            <div>
              <p className="font-bold tracking-tight text-slate-950">
                Project M
              </p>
              <p className="text-xs text-slate-500">
                Original interface studies · Edition 1
              </p>
            </div>
          </div>
          <nav
            aria-label="Design previews"
            className="flex gap-1 overflow-x-auto rounded-[12px] bg-slate-100 p-1"
          >
            {views.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                aria-current={view === item.id ? 'page' : undefined}
                className={`shrink-0 rounded-[9px] px-3.5 py-2 text-sm font-semibold transition ${view === item.id ? 'bg-white text-[#254889] shadow-sm' : 'text-slate-600 hover:text-slate-950'}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] p-3 sm:p-6">
        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Interactive concept · {currentTitle}
          </p>
          <p className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            <Sparkles size={14} className="text-[#254889]" /> Synthetic demo
            data
          </p>
        </div>
        <div className="overflow-hidden rounded-[16px] border border-slate-200 bg-white shadow-xl shadow-slate-300/30">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex items-center gap-2">
              <PanelLeft size={17} className="text-slate-500" />
              <h1 className="text-sm font-bold">{currentTitle}</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="Help"
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <CircleHelp size={17} />
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-[10px] border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700"
              >
                A. Teacher <ChevronDown size={14} />
              </button>
            </div>
          </div>
          {view === 'explorer' && <Explorer />}
          {view === 'resources' && <Resources />}
          {view === 'page' && <PageEditor />}
          {view === 'quiz' && <QuizEditor />}
        </div>
      </main>
    </div>
  );
}
