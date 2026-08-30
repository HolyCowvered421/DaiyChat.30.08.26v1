// @ts-nocheck
/// <reference types="https://esm.sh/@supabase/functions-js@2.0.0/edge-runtime.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PersonaName = "nutrition" | "training" | "calendar" | "dashboard";
type ChatRole = "user" | "assistant";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const personaPrompts: Record<PersonaName, string> = {
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

Nur Rezepte. Jugendfrei.`
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

interface PlanContext {
  muscle_group: string;
  location: string;
  experience: string;
  duration: string;
  days: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const persona = body.persona as string;
    const message = body.message as string;
    const context = body.context as PlanContext | undefined;

    if (!persona || !message) {
      return new Response(JSON.stringify({ error: "Missing persona or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = personaPrompts[persona] ?? personaPrompts.dashboard;

    const { data: memoryData } = await supabase
      .from("user_memory")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .eq("persona", persona)
      .order("created_at", { ascending: true })
      .limit(10);

    const persistedSummary = typeof memoryData?.memory_summary === "string" && memoryData.memory_summary.trim()
      ? memoryData.memory_summary.trim()
      : null;

    const memoryContext = memoryData
      ? `\n\nNutzer-Profil: Ziele: ${memoryData.goals ?? "nicht angegeben"}, Diät: ${memoryData.diet_type ?? "nicht angegeben"}, Allergien: ${(memoryData.allergies ?? []).join(", ") || "keine"}, Trainingsrhythmus: ${memoryData.training_rhythm ?? "nicht angegeben"}, Lieblingsessen: ${(memoryData.favorite_foods ?? []).join(", ") || "nicht angegeben"}, Kalorienziel: ${memoryData.calorie_target ?? "nicht angegeben"} kcal, Proteinziel: ${memoryData.protein_target ?? "nicht angegeben"}g.${persistedSummary ? `\nKurzgedächtnis: ${persistedSummary}` : ""}`
      : persistedSummary ? `\n\nKurzgedächtnis: ${persistedSummary}` : "";

    const historyMessages = (history ?? []).map((m: { role?: string; content?: string }) => ({
      role: (m.role as ChatRole) ?? "user",
      content: m.content ?? "",
    }));

    // If context is provided, this is a plan-generation request — build the prompt server-side
    const isPlanRequest = !!context && persona === "training";
    let userMessage = message;
    if (isPlanRequest) {
      userMessage = `Erstelle mir einen Trainingsplan mit folgenden Angaben:
- Fokus: ${context.muscle_group}
- Ort: ${context.location}
- Erfahrung: ${context.experience}
- Dauer pro Einheit: ${context.duration} Minuten
- Trainingstage pro Woche: ${context.days || "nicht angegeben"}

Bitte gib mir einen konkreten Plan mit 5-7 Übungen. Antworte NUR im JSON-Format:
{"title": "Plan-Titel", "exercises": [{"name": "Übungsname", "sets": 3, "reps": 12, "weight": 0, "notes": "optional"}]}`;
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("GOOGLE_API_KEY") ?? "";
    const configuredGeminiModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-3.5-flash";
    const geminiModels = [
      configuredGeminiModel,
      "gemini-3.6-flash",
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
    ].filter((model, index, arr) => model && arr.indexOf(model) === index);
    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

    if (!geminiKey && !openaiKey) {
      const fallback = generateFallbackResponse(persona, message, memoryData);
      if (isPlanRequest) {
        const fallbackPlan = generateFallbackPlan(context!.muscle_group, parseInt(context!.duration) || 45);
        return new Response(JSON.stringify({ plan: fallbackPlan }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        persona,
        role: "assistant",
        content: fallback,
      });
      return new Response(JSON.stringify({ response: fallback }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let aiResponse = "";

    if (geminiKey) {
      const geminiResult = await callGeminiWithFallback(geminiKey, geminiModels, systemPrompt + memoryContext, userMessage);
      if (!geminiResult.ok) {
        console.error("Gemini call failed", geminiResult.details);
        return new Response(
          JSON.stringify({
            error: "Gemini request failed",
            details: geminiResult.details,
            triedModels: geminiModels,
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      aiResponse = geminiResult.text;
    } else {
      const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt + memoryContext },
            ...historyMessages,
            { role: "user", content: userMessage },
          ],
          max_tokens: 800,
          temperature: 0.7,
        }),
      });

      if (!openaiResponse.ok) {
        const detailText = await openaiResponse.text().catch(() => "OpenAI request failed");
        console.error("OpenAI request failed", detailText);
        return new Response(
          JSON.stringify({ error: "OpenAI request failed", details: detailText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const aiData = await openaiResponse.json();
      aiResponse = aiData.choices?.[0]?.message?.content ?? "Entschuldigung, ich konnte keine Antwort generieren.";
    }

    // If plan request, try to parse JSON from the AI response
    if (isPlanRequest) {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.exercises && Array.isArray(parsed.exercises)) {
            const plan = {
              title: parsed.title || "KI-Trainingsplan",
              exercises: parsed.exercises.map((ex: any) => ({
                name: ex.name || "Übung",
                sets: ex.sets || 3,
                reps: ex.reps || 12,
                weight: ex.weight || 0,
                notes: ex.notes || "",
              })),
            };
            return new Response(JSON.stringify({ plan }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch {
          // fall through to fallback
        }
      }
      const fallbackPlan = generateFallbackPlan(context!.muscle_group, parseInt(context!.duration) || 45);
      return new Response(JSON.stringify({ plan: fallbackPlan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ response: aiResponse }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI persona error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", response: "Entschuldigung, es ist ein Fehler aufgetreten." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateFallbackResponse(persona: string, message: string, memory: any): string {
  const responses: Record<string, string[]> = {
    nutrition: [
      `Basierend auf deinem Profil empfehle ich dir eine ausgewogene Mahlzeit mit magerem Protein, komplexen Kohlenhydraten und gesunden Fetten. Was für eine Mahlzeit planst du – Frühstück, Mittag- oder Abendessen?`,
      `Ich kann dir helfen, einen Ernährungsplan zu erstellen. Erzähl mir mehr darüber, was du heute essen möchtest, und ich berücksichtige deine Allergien und Vorlieben.`,
    ],
    training: [
      `Lass uns einen Trainingsplan erstellen, der zu deinem Rhythmus passt. Welche Muskelgruppe möchtest du heute trainieren?`,
      `Für deinen Trainingsplan brauche ich ein paar Infos: Welche Übungen machst du gerne, und wie viel Zeit hast du heute?`,
    ],
    calendar: [
      `Ich helfe dir gerne, deinen Tag zu strukturieren. Welche Termine oder Aufgaben möchtest du planen?`,
      `Lass uns gemeinsam deinen Kalender organisieren. Was steht heute an?`,
    ],
    dashboard: [
      `Hallo! Ich bin deine Daiy Chat KI. Ich kann dir bei Ernährung, Training und Terminplanung helfen. Was möchtest du heute angehen?`,
      `Willkommen! Frag mich nach einem Ernährungsplan, Trainingsplan oder Terminen – ich bin hier, um deinen Alltag zu erleichtern.`,
    ],
  };

  const options = responses[persona] ?? responses.dashboard;
  return options[Math.floor(Math.random() * options.length)];
}

function generateFallbackPlan(muscleGroup: string, duration: number): { title: string; exercises: Array<{ name: string; sets: number; reps: number; weight: number; notes?: string }> } {
  const plans: Record<string, { title: string; exercises: Array<{ name: string; sets: number; reps: number; weight: number; notes?: string }> }> = {
    ganzkoerper: {
      title: "Ganzkörper-Training",
      exercises: [
        { name: "Kniebeugen", sets: 3, reps: 12, weight: 0, notes: "Aufwärmen" },
        { name: "Liegestütze", sets: 3, reps: 10, weight: 0 },
        { name: "Ausfallschritte", sets: 3, reps: 10, weight: 0, notes: "Pro Seite" },
        { name: "Plank", sets: 3, reps: 30, weight: 0, notes: "30 Sekunden" },
        { name: "Glute Bridge", sets: 3, reps: 15, weight: 0 },
        { name: "Superman", sets: 3, reps: 12, weight: 0 },
      ],
    },
    oberkoerper: {
      title: "Oberkörper-Training",
      exercises: [
        { name: "Bankdrücken", sets: 4, reps: 8, weight: 60 },
        { name: "Kurzhantel-Schulterdrücken", sets: 4, reps: 10, weight: 15 },
        { name: "Latzug", sets: 4, reps: 10, weight: 40 },
        { name: "Trizepsdrücken", sets: 3, reps: 12, weight: 25 },
        { name: "Bizeps-Curls", sets: 3, reps: 12, weight: 12 },
      ],
    },
    unterkoerper: {
      title: "Unterkörper-Training",
      exercises: [
        { name: "Kniebeugen", sets: 4, reps: 8, weight: 50 },
        { name: "Ausfallschritte", sets: 3, reps: 12, weight: 20 },
        { name: "Rumänisches Kreuzheben", sets: 4, reps: 10, weight: 60 },
        { name: "Beinpresse", sets: 3, reps: 12, weight: 80 },
        { name: "Wadenheben", sets: 4, reps: 15, weight: 40 },
      ],
    },
    cardio: {
      title: "Cardio-Training",
      exercises: [
        { name: "Burpees", sets: 4, reps: 10, weight: 0 },
        { name: "Mountain Climbers", sets: 4, reps: 30, weight: 0 },
        { name: "Jumping Jacks", sets: 3, reps: 30, weight: 0 },
        { name: "High Knees", sets: 3, reps: 30, weight: 0 },
        { name: "Skater Jumps", sets: 3, reps: 20, weight: 0 },
      ],
    },
    core: {
      title: "Core-Training",
      exercises: [
        { name: "Crunches", sets: 4, reps: 20, weight: 0 },
        { name: "Russian Twists", sets: 4, reps: 20, weight: 0, notes: "Pro Seite" },
        { name: "Plank", sets: 3, reps: 45, weight: 0, notes: "45 Sekunden" },
        { name: "Beinheben", sets: 3, reps: 15, weight: 0 },
        { name: "Bicycle Crunches", sets: 3, reps: 20, weight: 0 },
      ],
    },
  };

  return plans[muscleGroup] || plans.ganzkoerper;
}

async function callGeminiWithFallback(
  apiKey: string,
  models: string[],
  systemPrompt: string,
  userMessage: string
): Promise<{ ok: true; text: string } | { ok: false; details: string }> {
  let lastError = "Gemini request failed";

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [{
              role: "user",
              parts: [{ text: userMessage }],
            }],
            generationConfig: {
              maxOutputTokens: 1200,
              temperature: 0.7,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Gemini request failed");
        lastError = `Model ${model} failed: ${errorText}`;
        continue;
      }

      const data = await response.json();
      const text =
        data.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part.text ?? "")
          .join("") ?? "Entschuldigung, ich konnte keine Antwort generieren.";

      return { ok: true, text };
    } catch (error) {
      lastError = `Model ${model} threw: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return { ok: false, details: lastError };
}
