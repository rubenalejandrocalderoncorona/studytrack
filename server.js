const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3333;
const DATA_FILE = path.join(__dirname, 'data', 'progress.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Default seed data
const DEFAULT_DATA = {
  objectives: [
    {
      id: 'gcp-ml-engineer',
      title: 'GCP Professional ML Engineer',
      examDate: '2026-04-22',
      accentColor: '#378ADD',
      description: 'Google Cloud Professional Machine Learning Engineer certification. Covers Vertex AI, BigQuery ML, MLOps, Feature Engineering, and ML Pipelines.',
      phases: [
        {
          id: 'phase-1',
          title: 'Phase 1 — Foundation',
          dateRange: 'Mar 12–21',
          weeks: [
            {
              id: 'week-1',
              title: 'Week 1',
              dateRange: 'Mar 12–18',
              days: [
                {
                  id: 'day-1', dayNum: 1, date: '2026-03-12', label: 'Thu Mar 12', hours: 3,
                  tasks: [
                    { id: 't1-1', type: 'Coursera', text: 'Finish BigQuery ML lab — Course 1 (91%→100%)' },
                    { id: 't1-2', type: 'Review', text: 'Notes: Vertex AI key concepts & AutoML' }
                  ]
                },
                {
                  id: 'day-2', dayNum: 2, date: '2026-03-13', label: 'Fri Mar 13', hours: 1,
                  tasks: [
                    { id: 't2-1', type: 'Review', text: 'Course 1 flashcard review' },
                    { id: 't2-2', type: 'Udemy', text: 'Udemy Test 1 — skim & note weak areas' }
                  ]
                },
                {
                  id: 'day-3', dayNum: 3, date: '2026-03-14', label: 'Sat Mar 14', hours: 2,
                  tasks: [
                    { id: 't3-1', type: 'Coursera', text: 'Course 2: Launching into ML — Modules 1–2' },
                    { id: 't3-2', type: 'Review', text: 'Notes: supervised vs unsupervised, bias-variance' }
                  ]
                },
                {
                  id: 'day-4', dayNum: 4, date: '2026-03-15', label: 'Sun Mar 15', hours: 3,
                  tasks: [
                    { id: 't4-1', type: 'Coursera', text: 'Course 2: Modules 3–4 (gradient descent, generalization)' },
                    { id: 't4-2', type: 'Udemy', text: 'Practice Test 1 — full timed attempt' }
                  ]
                },
                {
                  id: 'day-5', dayNum: 5, date: '2026-03-16', label: 'Mon Mar 16', hours: 1,
                  tasks: [
                    { id: 't5-1', type: 'Review', text: 'Review Test 1 wrong answers — map to GCP domains' }
                  ]
                },
                {
                  id: 'day-6', dayNum: 6, date: '2026-03-17', label: 'Tue Mar 17', hours: 2,
                  tasks: [
                    { id: 't6-1', type: 'Coursera', text: 'Course 2: finish remaining modules' },
                    { id: 't6-2', type: 'Review', text: 'Summary notes — Course 2 key takeaways' }
                  ]
                },
                {
                  id: 'day-7', dayNum: 7, date: '2026-03-18', label: 'Wed Mar 18', hours: 3,
                  tasks: [
                    { id: 't7-1', type: 'Review', text: 'Consolidation day — re-read Courses 1 & 2 notes' },
                    { id: 't7-2', type: 'Review', text: 'Flashcard: loss functions, regularization, optimizers' }
                  ]
                }
              ]
            },
            {
              id: 'week-2',
              title: 'Week 2',
              dateRange: 'Mar 19–21',
              days: [
                {
                  id: 'day-8', dayNum: 8, date: '2026-03-19', label: 'Thu Mar 19', hours: 3,
                  tasks: [
                    { id: 't8-1', type: 'Coursera', text: 'Course 3: Keras — Modules 1–3' },
                    { id: 't8-2', type: 'Lab', text: 'Vertex AI AutoML lab walkthrough' }
                  ]
                },
                {
                  id: 'day-9', dayNum: 9, date: '2026-03-20', label: 'Fri Mar 20', hours: 1,
                  tasks: [
                    { id: 't9-1', type: 'Review', text: 'Flashcard: activation functions, Keras Sequential vs Functional API' }
                  ]
                },
                {
                  id: 'day-10', dayNum: 10, date: '2026-03-21', label: 'Sat Mar 21', hours: 2,
                  tasks: [
                    { id: 't10-1', type: 'Coursera', text: 'Course 3: Modules 4–5 (CNN/RNN intro)' },
                    { id: 't10-2', type: 'Udemy', text: 'Test 2 — first 60 questions' }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'phase-2',
          title: 'Phase 2 — Core ML',
          dateRange: 'Mar 22–Apr 2',
          weeks: [
            {
              id: 'week-3',
              title: 'Week 3',
              dateRange: 'Mar 22–28',
              days: [
                {
                  id: 'day-11', dayNum: 11, date: '2026-03-22', label: 'Sun Mar 22', hours: 3,
                  tasks: [
                    { id: 't11-1', type: 'Coursera', text: 'Course 3: Training at Scale with Vertex AI — graded assignment' },
                    { id: 't11-2', type: 'Lab', text: 'Vertex AI training at scale lab' }
                  ]
                },
                {
                  id: 'day-12', dayNum: 12, date: '2026-03-23', label: 'Mon Mar 23', hours: 1,
                  tasks: [
                    { id: 't12-1', type: 'Review', text: 'Course 3 deployment patterns' },
                    { id: 't12-2', type: 'Udemy', text: 'Test 2 — remaining questions' }
                  ]
                },
                {
                  id: 'day-13', dayNum: 13, date: '2026-03-24', label: 'Tue Mar 24', hours: 2,
                  tasks: [
                    { id: 't13-1', type: 'Review', text: 'Udemy Test 2 full review — map mistakes to GCP services' },
                    { id: 't13-2', type: 'Review', text: 'Notes: Vertex AI Pipelines vs Custom Training' }
                  ]
                },
                {
                  id: 'day-14', dayNum: 14, date: '2026-03-25', label: 'Wed Mar 25', hours: 3,
                  tasks: [
                    { id: 't14-1', type: 'Coursera', text: 'Course 4: Feature Engineering — Modules 1–3' },
                    { id: 't14-2', type: 'Review', text: 'Notes: TFX, Dataflow, feature crosses' }
                  ]
                },
                {
                  id: 'day-15', dayNum: 15, date: '2026-03-26', label: 'Thu Mar 26', hours: 1,
                  tasks: [
                    { id: 't15-1', type: 'Review', text: 'Flashcard: Feature Store, preprocessing, embeddings' }
                  ]
                },
                {
                  id: 'day-16', dayNum: 16, date: '2026-03-27', label: 'Fri Mar 27', hours: 2,
                  tasks: [
                    { id: 't16-1', type: 'Coursera', text: 'Course 4: finish remaining modules' },
                    { id: 't16-2', type: 'Review', text: 'Summary notes — feature importance, data leakage' }
                  ]
                },
                {
                  id: 'day-17', dayNum: 17, date: '2026-03-28', label: 'Sat Mar 28', hours: 3,
                  tasks: [
                    { id: 't17-1', type: 'Coursera', text: 'Course 5: ML in the Enterprise — Modules 1–3' },
                    { id: 't17-2', type: 'Review', text: 'Notes: business framing, monitoring, SLAs' }
                  ]
                }
              ]
            },
            {
              id: 'week-4',
              title: 'Week 4',
              dateRange: 'Mar 29–Apr 2',
              days: [
                {
                  id: 'day-18', dayNum: 18, date: '2026-03-29', label: 'Sun Mar 29', hours: 1,
                  tasks: [
                    { id: 't18-1', type: 'Udemy', text: 'Test 3 — full timed attempt' }
                  ]
                },
                {
                  id: 'day-19', dayNum: 19, date: '2026-03-30', label: 'Mon Mar 30', hours: 2,
                  tasks: [
                    { id: 't19-1', type: 'Review', text: 'Udemy Test 3 deep review — drill weak domains' },
                    { id: 't19-2', type: 'Coursera', text: 'Course 5: Modules 4–5' }
                  ]
                },
                {
                  id: 'day-20', dayNum: 20, date: '2026-03-31', label: 'Tue Mar 31', hours: 3,
                  tasks: [
                    { id: 't20-1', type: 'Coursera', text: 'Course 5: Complete + Start Course 6: Production ML Systems' },
                    { id: 't20-2', type: 'Review', text: 'Architecture patterns comparison' }
                  ]
                },
                {
                  id: 'day-21', dayNum: 21, date: '2026-04-01', label: 'Wed Apr 1', hours: 1,
                  tasks: [
                    { id: 't21-1', type: 'Review', text: 'Flashcard: A/B testing, shadow deployment, model serving' }
                  ]
                },
                {
                  id: 'day-22', dayNum: 22, date: '2026-04-02', label: 'Thu Apr 2', hours: 2,
                  tasks: [
                    { id: 't22-1', type: 'Coursera', text: 'Course 6: Production ML — Modules 1–3' },
                    { id: 't22-2', type: 'Review', text: 'Notes: CI/CD for ML, data drift, model decay' }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'phase-3',
          title: 'Phase 3 — Advanced Topics',
          dateRange: 'Apr 3–14',
          weeks: [
            {
              id: 'week-5',
              title: 'Week 5',
              dateRange: 'Apr 3–9',
              days: [
                {
                  id: 'day-23', dayNum: 23, date: '2026-04-03', label: 'Fri Apr 3', hours: 3,
                  tasks: [
                    { id: 't23-1', type: 'Coursera', text: 'Course 6: Finish Production ML Systems' },
                    { id: 't23-2', type: 'Udemy', text: 'Test 4 — full timed attempt' }
                  ]
                },
                {
                  id: 'day-24', dayNum: 24, date: '2026-04-04', label: 'Sat Apr 4', hours: 1,
                  tasks: [
                    { id: 't24-1', type: 'Review', text: 'Test 4 review — note MLOps gaps' },
                    { id: 't24-2', type: 'Review', text: 'Flashcard: Vertex Pipelines, Kubeflow, TFX' }
                  ]
                },
                {
                  id: 'day-25', dayNum: 25, date: '2026-04-05', label: 'Sun Apr 5', hours: 2,
                  tasks: [
                    { id: 't25-1', type: 'Coursera', text: 'Course 7: MLOps — Modules 1–3' },
                    { id: 't25-2', type: 'Review', text: 'Notes: experiment tracking, model registry' }
                  ]
                },
                {
                  id: 'day-26', dayNum: 26, date: '2026-04-06', label: 'Mon Apr 6', hours: 3,
                  tasks: [
                    { id: 't26-1', type: 'Coursera', text: 'Course 7: Finish MLOps' },
                    { id: 't26-2', type: 'Lab', text: 'Vertex AI Pipelines hands-on lab' }
                  ]
                },
                {
                  id: 'day-27', dayNum: 27, date: '2026-04-07', label: 'Tue Apr 7', hours: 1,
                  tasks: [
                    { id: 't27-1', type: 'Review', text: 'Summary: CI/CD, monitoring, retraining triggers, Vertex Experiments' }
                  ]
                },
                {
                  id: 'day-28', dayNum: 28, date: '2026-04-08', label: 'Wed Apr 8', hours: 2,
                  tasks: [
                    { id: 't28-1', type: 'Coursera', text: 'Course 8: ML Pipelines — Modules 1–3' },
                    { id: 't28-2', type: 'Review', text: 'Notes: Kubeflow vs Vertex AI Pipelines' }
                  ]
                },
                {
                  id: 'day-29', dayNum: 29, date: '2026-04-09', label: 'Thu Apr 9', hours: 3,
                  tasks: [
                    { id: 't29-1', type: 'Coursera', text: 'Course 8: Finish ML Pipelines' },
                    { id: 't29-2', type: 'Udemy', text: 'Test 5 — full timed attempt' }
                  ]
                }
              ]
            },
            {
              id: 'week-6',
              title: 'Week 6',
              dateRange: 'Apr 10–14',
              days: [
                {
                  id: 'day-30', dayNum: 30, date: '2026-04-10', label: 'Fri Apr 10', hours: 1,
                  tasks: [
                    { id: 't30-1', type: 'Review', text: 'Test 5 review — spot domain gaps' },
                    { id: 't30-2', type: 'Review', text: 'Focus: BigQuery ML SQL & model types' }
                  ]
                },
                {
                  id: 'day-31', dayNum: 31, date: '2026-04-11', label: 'Sat Apr 11', hours: 2,
                  tasks: [
                    { id: 't31-1', type: 'Review', text: 'Deep dive: Responsible AI, fairness, Explainable AI' },
                    { id: 't31-2', type: 'Review', text: 'AI ethics in GCP exam context' }
                  ]
                },
                {
                  id: 'day-32', dayNum: 32, date: '2026-04-12', label: 'Sun Apr 12', hours: 3,
                  tasks: [
                    { id: 't32-1', type: 'Lab', text: 'BigQuery ML end-to-end practice lab' },
                    { id: 't32-2', type: 'Review', text: 'GCP service mindmap (all 8 courses)' }
                  ]
                },
                {
                  id: 'day-33', dayNum: 33, date: '2026-04-13', label: 'Mon Apr 13', hours: 1,
                  tasks: [
                    { id: 't33-1', type: 'Review', text: 'Flashcard sprint — entire Coursera path key terms' }
                  ]
                },
                {
                  id: 'day-34', dayNum: 34, date: '2026-04-14', label: 'Tue Apr 14', hours: 2,
                  tasks: [
                    { id: 't34-1', type: 'Udemy', text: 'Test 6 — full timed, exam conditions' },
                    { id: 't34-2', type: 'Review', text: 'Score analysis — categorize wrong answers by topic' }
                  ]
                }
              ]
            }
          ]
        },
        {
          id: 'phase-4',
          title: 'Phase 4 — Exam Sprint',
          dateRange: 'Apr 15–22',
          weeks: [
            {
              id: 'week-7',
              title: 'Week 7',
              dateRange: 'Apr 15–22',
              days: [
                {
                  id: 'day-35', dayNum: 35, date: '2026-04-15', label: 'Wed Apr 15', hours: 3,
                  tasks: [
                    { id: 't35-1', type: 'Exam', text: 'Full timed mock exam — mix Tests 5 & 6 questions' },
                    { id: 't35-2', type: 'Review', text: 'Post-exam: prioritize lowest-confidence topics' }
                  ]
                },
                {
                  id: 'day-36', dayNum: 36, date: '2026-04-16', label: 'Thu Apr 16', hours: 1,
                  tasks: [
                    { id: 't36-1', type: 'Review', text: 'Focused review: weakest 2 domains from mocks' },
                    { id: 't36-2', type: 'Review', text: 'Flashcard: GCP services mapped to ML use cases' }
                  ]
                },
                {
                  id: 'day-37', dayNum: 37, date: '2026-04-17', label: 'Fri Apr 17', hours: 2,
                  tasks: [
                    { id: 't37-1', type: 'Review', text: 'Re-read official GCP ML Engineer exam guide' },
                    { id: 't37-2', type: 'Review', text: 'Cross-check every topic vs your notes' }
                  ]
                },
                {
                  id: 'day-38', dayNum: 38, date: '2026-04-18', label: 'Sat Apr 18', hours: 3,
                  tasks: [
                    { id: 't38-1', type: 'Exam', text: 'Second full mock exam — target 80%+ score' },
                    { id: 't38-2', type: 'Review', text: 'Final review of all wrong answers' }
                  ]
                },
                {
                  id: 'day-39', dayNum: 39, date: '2026-04-19', label: 'Sun Apr 19', hours: 1,
                  tasks: [
                    { id: 't39-1', type: 'Review', text: 'Light review only — no new material' },
                    { id: 't39-2', type: 'Review', text: 'Revisit correct answers for confidence' }
                  ]
                },
                {
                  id: 'day-40', dayNum: 40, date: '2026-04-20', label: 'Mon Apr 20', hours: 2,
                  tasks: [
                    { id: 't40-1', type: 'Review', text: 'Top 20 flashcards: Vertex AI, BigQuery ML, MLOps' },
                    { id: 't40-2', type: 'Review', text: 'Prepare exam logistics' }
                  ]
                },
                {
                  id: 'day-41', dayNum: 41, date: '2026-04-21', label: 'Tue Apr 21', hours: 1,
                  tasks: [
                    { id: 't41-1', type: 'Review', text: 'Rest day — 30 min max, light review' },
                    { id: 't41-2', type: 'Review', text: 'Sleep well. You\'ve done the work.' }
                  ]
                },
                {
                  id: 'day-exam', dayNum: 42, date: '2026-04-22', label: 'Wed Apr 22', hours: 0,
                  isExamDay: true,
                  tasks: [
                    { id: 'texam-1', type: 'Exam', text: 'GCP Professional Machine Learning Engineer Certification 🎯' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  checked: {}
};

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadProgress() {
  ensureDataDir();
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return DEFAULT_DATA;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error reading progress file, resetting to default:', e);
    fs.writeFileSync(DATA_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
    return DEFAULT_DATA;
  }
}

function saveProgress(data) {
  ensureDataDir();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all data
app.get('/api/progress', (req, res) => {
  const data = loadProgress();
  res.json(data);
});

// POST toggle task checked state
app.post('/api/progress', (req, res) => {
  const { taskId, checked } = req.body;
  if (typeof taskId !== 'string' || typeof checked !== 'boolean') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const data = loadProgress();
  data.checked[taskId] = checked;
  saveProgress(data);
  res.json({ ok: true });
});

// POST add a new objective
app.post('/api/objectives', (req, res) => {
  const { title, examDate, accentColor, description } = req.body;
  if (!title || !examDate) {
    return res.status(400).json({ error: 'title and examDate required' });
  }
  const data = loadProgress();
  const id = 'obj-' + Date.now();
  data.objectives.push({
    id,
    title,
    examDate,
    accentColor: accentColor || '#f0ede6',
    description: description || '',
    phases: []
  });
  saveProgress(data);
  res.json({ ok: true, id });
});

// DELETE an objective
app.delete('/api/objectives/:id', (req, res) => {
  const data = loadProgress();
  data.objectives = data.objectives.filter(o => o.id !== req.params.id);
  saveProgress(data);
  res.json({ ok: true });
});

// PUT update full objective (for JSON editor & task editing)
app.put('/api/objectives/:id', (req, res) => {
  const { id } = req.params;
  const updated = req.body;
  if (!updated || !updated.title || !updated.examDate) {
    return res.status(400).json({ error: 'Invalid objective data' });
  }
  const data = loadProgress();
  const idx = data.objectives.findIndex(o => o.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Objective not found' });
  // Preserve the id
  updated.id = id;
  data.objectives[idx] = updated;
  saveProgress(data);
  res.json({ ok: true });
});

// POST save/update a task note
app.post('/api/notes', (req, res) => {
  const { taskId, note } = req.body;
  if (typeof taskId !== 'string') {
    return res.status(400).json({ error: 'Invalid payload' });
  }
  const data = loadProgress();
  if (!data.notes) data.notes = {};
  if (note === '' || note == null) {
    delete data.notes[taskId];
  } else {
    data.notes[taskId] = note;
  }
  saveProgress(data);
  res.json({ ok: true });
});

// GET version info
app.get('/api/version', (req, res) => {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(__dirname, 'version.json'), 'utf8'));
    res.json(v);
  } catch (e) {
    res.json({ version: 'beta', build: '0.1.0-beta' });
  }
});

// GET export full progress.json as download
app.get('/api/export', (req, res) => {
  const data = loadProgress();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="studytrack-export.json"');
  res.send(JSON.stringify(data, null, 2));
});

// POST save custom types
app.post('/api/custom-types', (req, res) => {
  const { customTypes } = req.body;
  if (!Array.isArray(customTypes)) return res.status(400).json({ error: 'customTypes must be array' });
  const data = loadProgress();
  data.customTypes = customTypes;
  saveProgress(data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`StudyTrack running at http://localhost:${PORT}`);
});
