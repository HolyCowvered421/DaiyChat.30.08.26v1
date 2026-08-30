import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { PersonaId } from '@/lib/ai/types';

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: 'Server not configured' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json();
    const { ai_id, user_id, response } = body as {
      ai_id: PersonaId;
      user_id: string;
      response: string;
    };

    if (!ai_id || !user_id || !response) {
      return NextResponse.json(
        { error: 'Missing ai_id, user_id, or response' },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase.from('chat_messages').insert({
      user_id,
      persona: ai_id as PersonaId,
      role: 'assistant',
      content: response,
    });

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to persist AI response' },
        { status: 500 }
      );
    }

    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(8);

    const compactSummary = (recentMessages ?? [])
      .slice(0, 8)
      .map((message) => {
        const text = (message.content ?? '').replace(/\s+/g, ' ').trim();
        return text.length > 140 ? `${text.slice(0, 130)}...` : text;
      })
      .filter(Boolean)
      .join(' | ');

    const { data: existingMemory } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle();

    const { error: memoryError } = await supabase
      .from('user_memory')
      .upsert(
        {
          user_id,
          goals: existingMemory?.goals ?? null,
          diet_type: existingMemory?.diet_type ?? null,
          allergies: existingMemory?.allergies ?? [],
          training_rhythm: existingMemory?.training_rhythm ?? null,
          favorite_foods: existingMemory?.favorite_foods ?? [],
          calorie_target: existingMemory?.calorie_target ?? null,
          protein_target: existingMemory?.protein_target ?? null,
          carbs_target: existingMemory?.carbs_target ?? null,
          fat_target: existingMemory?.fat_target ?? null,
          memory_summary: compactSummary || existingMemory?.memory_summary || null,
        },
        { onConflict: 'user_id' }
      );

    if (memoryError) {
      return NextResponse.json(
        { error: 'Failed to update user memory' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
