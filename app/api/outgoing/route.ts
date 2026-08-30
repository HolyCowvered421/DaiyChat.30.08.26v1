import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PersonaId } from '@/lib/ai/types';
import { buildRecipeLibraryContext } from '@/lib/ai/recipe-library';

const personaPrompts: Record<PersonaId, string> = {
  nutrition: `Du bist Omni Daily Ernährung-KI. Antworte IMMER nur mit Rezepten in DIESEM Format - KEIN Text davor/danach:

[REZEPT-NAME]
Kal: XXXkcal | Prot: XXg | Kohlen: XXg | Fett: XXg

ZUTATEN:
- Zutat1 (Menge)
- Zutat2 (Menge)
- Zutat3 (Menge)

ZUBEREITUNG:
1. Schritt1 kurz
2. Schritt2 kurz
3. Schritt3 kurz

BEISPIEL:
[Hähnchen Nudel Pfanne]
Kal: 550kcal | Prot: 40g | Kohlen: 65g | Fett: 8g

ZUTATEN:
- 150g Hähnchenbrust
- 200g Vollkornnudeln
- 1 Zucchini

ZUBEREITUNG:
1. Nudeln kochen
2. Hähnchen anbraten
3. Zucchini hinzufügen

Nur Rezepte. Jugendfrei.`,
  training: `Du bist die Trainings-KI von Omni Daily. Deine Aufgabe ist es, Trainingspläne, Bewegungsroutinen, Übungsreihenfolgen und Fortschrittsideen zu erstellen. Antworte auf Deutsch, freundlich und sehr konkret. Nutze klare Sets, Wiederholungen, Pausen und passende Progression.

WICHTIG - SICHERHEIT & FOKUS:
1. Antworte ausschließlich themenbezogen auf Fitness, Sport, Krafttraining und Bewegung.
2. Achte auf altersgerechte, sichere Übungen und vermeide Verletzungsrisiken durch übertriebene Lasten bei Anfängern oder Jugendlichen.
3. Jugendschutz: Die App wird auch von Minderjährigen unter 18 Jahren genutzt. Jegliche unangemessenen Inhalte, sexuelle Anspielungen oder themenfremde Abschweifungen sind strengstens verboten. Bleibe zu 100% jugendfrei, sicher und sachlich. Lenke vom Thema abweichende Fragen sofort auf Sport und Fitness zurück.`,
  calendar: `Du bist die Kalender-KI von Omni Daily. Deine Aufgabe ist es, Termine, Prioritäten, Tagesplanung und Work-Life-Balance zu organisieren. Antworte auf Deutsch, freundlich, strukturiert und effizient. Hilf dabei, Aufgaben logisch zu sortieren und Zeitfenster sinnvoll zu planen.

WICHTIG - SICHERHEIT & FOKUS:
1. Antworte ausschließlich themenbezogen auf Organisation, Zeitmanagement, Terminplanung und Produktivität.
2. Jugendschutz: Die App wird auch von Minderjährigen unter 18 Jahren genutzt. Jegliche unangemessenen Inhalte, sexuelle Anspielungen oder themenfremde Abschweifungen sind strengstens verboten. Bleibe zu 100% jugendfrei, sicher und sachlich. Bei sachfremden Fragen konzentriere dich rein auf die Kalender- und Alltagsstruktur.`,
  dashboard: `Du bist die zentrale Omni-Daily-KI. Du bist der Alltagsassistent für Ernährung, Training, Kalender und allgemeine Lebensplanung. Antworte auf Deutsch, freundlich und hilfreich, mit klaren Empfehlungen und kurzen, verständlichen Antworten.

WICHTIG - SICHERHEIT & FOKUS:
1. Antworte ausschließlich themenbezogen auf die Kernbereiche der App (Ernährung, Training, Organisation).
2. Jugendschutz: Die App wird auch von Minderjährigen unter 18 Jahren genutzt. Jegliche unangemessenen Inhalte, sexuelle Anspielungen, politische Diskussionen oder themenfremde Abschweifungen sind strengstens verboten. Bleibe zu 100% jugendfrei, sicher und sachlich. Sobald der Nutzer das Thema wechselt, brich ab und verweise auf die App-Inhalte.`,
};

function buildMemorySummary(memory: Record<string, any> | null) {
  if (!memory) {
    return 'Keine Profilinformationen verfügbar. Bitte frage gezielt nach den wichtigsten Zielen und Vorlieben.';
  }

  const persistedSummary = typeof memory.memory_summary === 'string' && memory.memory_summary.trim()
    ? memory.memory_summary.trim()
    : null;

  const goals = memory.goals ?? 'nicht angegeben';
  const dietType = memory.diet_type ?? 'nicht angegeben';
  const allergies = Array.isArray(memory.allergies) && memory.allergies.length > 0 ? memory.allergies.join(', ') : 'keine';
  const favoriteFoods = Array.isArray(memory.favorite_foods) && memory.favorite_foods.length > 0 ? memory.favorite_foods.join(', ') : 'keine';
  const trainingRhythm = memory.training_rhythm ?? 'nicht angegeben';
  const calorieTarget = memory.calorie_target ?? 'nicht angegeben';
  const proteinTarget = memory.protein_target ?? 'nicht angegeben';
  const carbsTarget = memory.carbs_target ?? 'nicht angegeben';
  const fatTarget = memory.fat_target ?? 'nicht angegeben';

  const baseSummary = `Nutzerprofil:\n- Ziel: ${goals}\n- Ernährung: ${dietType}\n- Allergien: ${allergies}\n- Lieblingsessen: ${favoriteFoods}\n- Trainingsrhythmus: ${trainingRhythm}\n- Kalorienziel: ${calorieTarget} kcal\n- Proteinziel: ${proteinTarget} g\n- Kohlenhydratziel: ${carbsTarget} g\n- Fettziel: ${fatTarget} g`;

  return persistedSummary ? `${baseSummary}\n\nKurzgedächtnis: ${persistedSummary}` : baseSummary;
}

function buildConversationSummary(messages: Array<{ role: string; content: string }> = []) {
  if (!messages.length) {
    return 'Keine früheren Chat-Interaktionen.';
  }

  const recent = [...messages]
    .slice(-6)
    .reverse()
    .map((message) => {
      const cleanText = message.content
        .replace(/\s+/g, ' ')
        .trim();
      return cleanText.length > 120 ? `${cleanText.slice(0, 110)}...` : cleanText;
    })
    .filter(Boolean)
    .join(' | ');

  return recent ? `Kurzgedächtnis: ${recent}` : 'Keine früheren Chat-Interaktionen.';
}

function buildPromptForPersona(persona: PersonaId, message: string, context?: Record<string, string>, memorySummary?: string, conversationSummary?: string) {
  const basePrompt = personaPrompts[persona] ?? personaPrompts.dashboard;
  const memorySection = memorySummary ? `\n\n${memorySummary}\n` : '';
  const conversationSection = conversationSummary ? `\n\n${conversationSummary}\n` : '';
  const recipeLibrary = persona === 'nutrition' ? `\n\nStandard-Rezeptbibliothek (Backend): ${buildRecipeLibraryContext(6)}\n` : '';

  if (persona === 'training' && context) {
    return `Erstelle mir einen Trainingsplan mit folgenden Angaben:
- Fokus: ${context.muscle_group ?? 'Ganzkörper'}
- Ort: ${context.location ?? 'Home'}
- Erfahrung: ${context.experience ?? 'Anfänger'}
- Dauer pro Einheit: ${context.duration ?? '45'} Minuten
- Trainingstage pro Woche: ${context.days ?? '3'}

Bitte antworte NUR im JSON-Format:
{"title": "Plan-Titel", "exercises": [{"name": "Übungsname", "sets": 3, "reps": 12, "weight": 0, "notes": "optional"}]}

${memorySection}${conversationSection}
Zusätzliche Nutzeranfrage: ${message}`;
  }

  return `${basePrompt}${memorySection}${conversationSection}${recipeLibrary}\n\nUser-Anfrage: ${message}`;
}

function buildFallbackPlan(context?: Record<string, string>) {
  const muscleGroup = (context?.muscle_group || 'ganzkoerper').toLowerCase();
  const duration = Number.parseInt(context?.duration || '45', 10) || 45;

  const plans: Record<string, { title: string; exercises: Array<{ name: string; sets: number; reps: number; weight: number; notes?: string }> }> = {
    ganzkoerper: {
      title: 'Ganzkörper-Training',
      exercises: [
        { name: 'Kniebeugen', sets: 3, reps: 12, weight: 0, notes: 'Aufwärmen' },
        { name: 'Liegestütze', sets: 3, reps: 10, weight: 0 },
        { name: 'Ausfallschritte', sets: 3, reps: 10, weight: 0, notes: 'Pro Seite' },
        { name: 'Plank', sets: 3, reps: 30, weight: 0, notes: '30 Sekunden' },
        { name: 'Glute Bridge', sets: 3, reps: 15, weight: 0 },
      ],
    },
    oberkoerper: {
      title: 'Oberkörper-Training',
      exercises: [
        { name: 'Bankdrücken', sets: 4, reps: 8, weight: 60 },
        { name: 'Schulterdrücken', sets: 4, reps: 10, weight: 15 },
        { name: 'Latzug', sets: 4, reps: 10, weight: 40 },
        { name: 'Trizepsdrücken', sets: 3, reps: 12, weight: 25 },
        { name: 'Bizeps-Curls', sets: 3, reps: 12, weight: 12 },
      ],
    },
    unterkoerper: {
      title: 'Unterkörper-Training',
      exercises: [
        { name: 'Kniebeugen', sets: 4, reps: 8, weight: 50 },
        { name: 'Ausfallschritte', sets: 3, reps: 12, weight: 20 },
        { name: 'Romanian Deadlift', sets: 4, reps: 10, weight: 60 },
        { name: 'Beinpresse', sets: 3, reps: 12, weight: 80 },
        { name: 'Wadenheben', sets: 4, reps: 15, weight: 40 },
      ],
    },
    cardio: {
      title: 'Cardio-Training',
      exercises: [
        { name: 'Burpees', sets: 4, reps: 10, weight: 0 },
        { name: 'Mountain Climbers', sets: 4, reps: 30, weight: 0 },
        { name: 'Jumping Jacks', sets: 3, reps: 30, weight: 0 },
        { name: 'High Knees', sets: 3, reps: 30, weight: 0 },
      ],
    },
    core: {
      title: 'Core-Training',
      exercises: [
        { name: 'Crunches', sets: 4, reps: 20, weight: 0 },
        { name: 'Russian Twists', sets: 4, reps: 20, weight: 0, notes: 'Pro Seite' },
        { name: 'Plank', sets: 3, reps: 45, weight: 0, notes: '45 Sekunden' },
        { name: 'Beinheben', sets: 3, reps: 15, weight: 0 },
      ],
    },
  };

  const chosen = plans[muscleGroup] ?? plans.ganzkoerper;
  return {
    title: chosen.title,
    exercises: chosen.exercises.map((exercise, index) => ({
      ...exercise,
      sets: Math.max(2, Math.min(5, exercise.sets + Math.max(0, Math.round(duration / 45) - 1) + (index % 2 === 0 ? 0 : 1))),
    })),
  };
}

function extractJsonPlan(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[0]);
    if (parsed && Array.isArray(parsed.exercises)) {
      return {
        title: parsed.title || 'KI-Trainingsplan',
        exercises: parsed.exercises.map((exercise: any) => ({
          name: exercise.name || 'Übung',
          sets: Number(exercise.sets) || 3,
          reps: Number(exercise.reps) || 12,
          weight: Number(exercise.weight) || 0,
          notes: exercise.notes || '',
        })),
      };
    }
  } catch {
    return null;
  }

  return null;
}

async function callGeminiText(systemPrompt: string, userPrompt: string) {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  const requestedModels = [
    process.env.GEMINI_MODEL,
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ].filter((model, index, arr) => model && arr.indexOf(model) === index);

  if (!geminiKey) {
    throw new Error('No Gemini API key configured');
  }

  let lastError = 'Gemini request failed';

  for (const model of requestedModels.length > 0 ? requestedModels : ['gemini-2.0-flash']) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: 1200, temperature: 0.7 },
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text().catch(() => 'Gemini request failed');
        lastError = `Gemini failed for model ${model}: ${text}`;
        continue;
      }

      const data = await response.json();
      return (
        data.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? '')
          .join('') ?? 'Entschuldigung, ich konnte keine Antwort generieren.'
      );
    } catch (error) {
      lastError = `Gemini model ${model} threw: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  throw new Error(lastError);
}

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { message, ai_id, context } = body as {
      message: string;
      ai_id: PersonaId;
      context?: Record<string, string>;
    };

    if (!message || !ai_id) {
      return NextResponse.json(
        { error: 'Missing message or ai_id' },
        { status: 400 }
      );
    }

    const { data: statusRow } = await supabase
      .from('ai_status')
      .select('status, maintenance_message')
      .eq('ai_id', ai_id as string)
      .maybeSingle();

    if (statusRow?.status === 'maintenance') {
      return NextResponse.json(
        {
          error: 'maintenance',
          maintenance_message:
            statusRow.maintenance_message ?? 'Diese KI wird gerade gewartet und ist vorübergehend nicht verfügbar.',
        },
        { status: 503 }
      );
    }

    const { data: userMemory } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const { data: recentChatMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12);

    const memorySummary = buildMemorySummary(userMemory);
    const conversationSummary = buildConversationSummary(recentChatMessages ?? []);

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/ai-persona`;
    const edgePayload = context ? { persona: ai_id, message, context } : { persona: ai_id, message };

    let backendResponse: Response | null = null;
    try {
      backendResponse = await fetch(edgeFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(edgePayload),
      });
    } catch {
      backendResponse = null;
    }

    if (backendResponse && backendResponse.ok) {
      const data = await backendResponse.json();
      if (data.plan) {
        return NextResponse.json({ plan: data.plan, ai_id });
      }
      if (data.response) {
        return NextResponse.json({ response: data.response, ai_id });
      }
    }

    try {
      const userPrompt = buildPromptForPersona(ai_id, message, context, memorySummary, conversationSummary);
      const text = await callGeminiText(personaPrompts[ai_id] ?? personaPrompts.dashboard, userPrompt);
      const plan = ai_id === 'training' ? extractJsonPlan(text) ?? buildFallbackPlan(context) : null;

      if (plan) {
        return NextResponse.json({ plan, ai_id });
      }

      return NextResponse.json({ response: text, ai_id });
    } catch (error) {
      const fallbackMessage = ai_id === 'training'
        ? 'Ich habe den Trainingsplan vorläufig vorbereitet. Stelle mir bitte noch Fokus, Erfahrung und Zielsetzung vor, damit ich den Plan genauer auf dich abstimme.'
        : 'Ich bin gerade kurz nicht erreichbar. Bitte versuche es in einem Moment erneut.';

      if (ai_id === 'training' && context) {
        return NextResponse.json({ plan: buildFallbackPlan(context), ai_id });
      }

      return NextResponse.json(
        {
          error: 'AI backend request failed',
          details: error instanceof Error ? error.message : 'Unknown error',
          response: fallbackMessage,
        },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      {
        error: 'Internal server error',
        response: 'Entschuldigung, es ist ein Fehler aufgetreten.',
      },
      { status: 500 }
    );
  }
}
