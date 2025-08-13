import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { aiSdkOpenai, generateText } from "@/lib/openai"
import { auth } from "@/lib/firebaseAdmin"
import { findSimilarDialogExamples } from "@/lib/embeddings"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"

// ✅ GET: Get single chat message by chatId
export async function GET(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get("chatId")

  if (!chatId) {
    return NextResponse.json({ error: "chatId is required" }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", chatId)
    .eq("user_id", userId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 })
  }

  return NextResponse.json(data, { status: 200 })
}

// ✅ DELETE: Delete single chat message by chatId
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const chatId = searchParams.get("chatId")
  const personaId = searchParams.get("personaId")
  const deleteAllForUser = searchParams.get("deleteAllForUser")


  // Delete chat by Chat ID
  if (chatId) {
    const supabase = createClient()

    const { data, error: selectError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", userId)
      .single()

    if (selectError || !data) {
      return NextResponse.json({ error: "No matching Chat found for user" }, { status: 404 })
    }

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", chatId)
      .eq("user_id", userId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 })
    }

    return NextResponse.json({ message: "Chat deleted" }, { status: 200 })
  }

  // Delete all chat for this user by Persona ID
  if (personaId) {
    const supabase = createClient()

    const { data, error: fetchError } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("persona_id", personaId)
      .limit(1)

    if (fetchError || !data || data.length === 0) {
      return NextResponse.json({ message: "No chats found for this persona" }, { status: 200 })
    }

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("user_id", userId)
      .eq("persona_id", personaId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete chats for persona" }, { status: 500 })
    }

    return NextResponse.json({ message: `Chats with persona ${personaId} deleted` }, { status: 200 })
  }

  // ✅ DELETE: Delete all chats for current user
  if (deleteAllForUser) {
    const supabase = createClient()

    const { data, error: fetchError } = await supabase
      .from("conversations")
      .select("id")
      .eq("user_id", userId)
      .limit(1)

    if (fetchError || !data || data.length === 0) {
      return NextResponse.json({ message: "No chats to delete for user" }, { status: 200 })
    }

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("user_id", userId)

    if (error) {
      return NextResponse.json({ error: "Failed to delete all chats" }, { status: 500 })
    }

    return NextResponse.json({ message: "All user chats deleted" }, { status: 200 })

  }

}
const CALL_MAX_TOKENS = Number(process.env.CALL_MAX_TOKENS) ?? 50
const CALL_TEMPERATURE = Number(process.env.CALL_TEMPERATURE) ?? 0.4

const CALL_STOP: string[] = (() => {
  try {
    return JSON.parse(process.env.CALL_STOP || "[]");
  } catch {
    console.warn("Invalid CALL_STOP env format, falling back to defaults");
    return ["\n\n", "User:", "You:", "USER:", "ASSISTANT:"];
  }
})();

// Helper: strip common emoji/pictographs (keeps ASCII + basic punctuation)
const stripEmojis = (s: string) =>
  s.replace(
    /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{200D}\u{2640}-\u{2642}\u{2600}-\u{27BF}]/gu,
    ""
  );


// ✅ POST: Create a single chat message and persist it
export async function POST(req: NextRequest) {
  // helpers for timing/size (logging only)
  const ms = () => (globalThis.performance?.now?.() ?? Date.now());
  const bytes = (s: string) => (typeof s === "string" ? new TextEncoder().encode(s).length : 0);

  const tReq0 = ms();

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized request or Token Expired" }, { status: 401 });
  }

  try {
    const tParse0 = ms();
    const { personaId, message, initiateChat, isCall } = await req.json();
    const tParse1 = ms();
    console.log("[CHAT] request_parsed", { ms: Math.round(tParse1 - tParse0), initiateChat, isCall });

    console.log("[CHAT] received_user_message", { len: (message?.length ?? 0) });

    if (!personaId && (message || initiateChat)) {
      return NextResponse.json({ error: "Persona ID is required" }, { status: 400 });
    }

    // ------------------------------------------------------------------------
    // INITIATE CHAT BRANCH
    // ------------------------------------------------------------------------
    if (initiateChat) {
      const supabase = createClient();

      const tUser0 = ms();
      const { data: userProfile, error: userError } =
        await supabase.from("users").select("*").eq("id", userId).single();
      const tUser1 = ms();
      console.log("[DB] user_profile", { ms: Math.round(tUser1 - tUser0), ok: !userError });

      if (userError || !userProfile) {
        console.error("[CHAT] user profile not found:", userError);
        return NextResponse.json({ error: "User profile not found" }, { status: 404 });
      }

      const tPersona0 = ms();
      const { data: persona, error: personaError } =
        await supabase.from("personas").select("*").eq("id", personaId).single();
      const tPersona1 = ms();
      console.log("[DB] persona", { ms: Math.round(tPersona1 - tPersona0), ok: !personaError });

      if (personaError || !persona) {
        console.error("[CHAT] persona not found:", personaError);
        return NextResponse.json({ error: "Persona not found" }, { status: 404 });
      }

      // Build messages (no behavior change)
      let enhancedPrompt = persona.initial_prompt;
      const messagesForAI = [{ role: "system" as const, content: enhancedPrompt }];

      // LLM timing
      const promptBytes = bytes(enhancedPrompt);
      const tLLM0 = ms();
      const { text: aiSeed } = await generateText({
        model: aiSdkOpenai("gpt-4o-mini"),
        messages: messagesForAI,
      });
      const tLLM1 = ms();

      console.log("[LLM:init] done", {
        ms: Math.round(tLLM1 - tLLM0),
        promptBytes,
        aiChars: aiSeed?.length ?? 0,
      });
      console.log("[CHAT] initiate_response_sample", aiSeed?.slice(0, 120));

      // Persist assistant seed (unchanged)
      try {
        const tStore0 = ms();
        await supabase.from("conversations").insert([
          { user_id: userId, persona_id: personaId, role: "assistant", content: aiSeed },
        ]);
        const tStore1 = ms();
        console.log("[DB] store_seed", { ms: Math.round(tStore1 - tStore0) });
      } catch (err) {
        console.log("[DB] store_seed_failed", err);
      }

      const res = NextResponse.json({ response: aiSeed }, { status: 200 });
      // Headers for client-side correlation
      res.headers.set("x-llm-ms", String(Math.round(tLLM1 - tLLM0)));
      res.headers.set("x-llm-ai-chars", String(aiSeed?.length ?? 0));
      res.headers.set("x-llm-prompt-bytes", String(promptBytes));
      res.headers.set("x-req-ms", String(Math.round(ms() - tReq0)));
      return res;
    }

    // ------------------------------------------------------------------------
    // NORMAL / CALL CHAT BRANCH
    // ------------------------------------------------------------------------
    const supabase = createClient();
    const tDbAll0 = ms();

    const [userRes, personaRes, convRes] = await Promise.all([
      supabase.from("users").select("*").eq("id", userId).single(),
      supabase.from("personas").select("*").eq("id", personaId).single(),
      supabase
        .from("conversations")
        .select("role, content, timestamp")
        .eq("user_id", userId)
        .eq("persona_id", personaId)
        .gte("timestamp", new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString())
        .order("timestamp", { ascending: true })
        .limit(isCall ? 6 : 20), // trimmed for calls
    ]);
    const tDbAll1 = ms();
    console.log("[DB] batch", {
      ms: Math.round(tDbAll1 - tDbAll0),
      userOk: !userRes.error,
      personaOk: !personaRes.error,
      convOk: !convRes.error,
      turns: convRes.data?.length ?? 0,
    });

    const userProfile = userRes.data;
    const persona = personaRes.data;
    const recentConversations = convRes.data;

    if (!userProfile) return NextResponse.json({ error: "User profile not found" }, { status: 404 });
    if (!persona) return NextResponse.json({ error: "Persona not found" }, { status: 404 });

    // Examples: skip for calls
    let similarExamples: any[] = [];
    if (!isCall) {
      const tEx0 = ms();
      similarExamples = await findSimilarDialogExamples(personaId, message, 3, 0.7);
      const tEx1 = ms();
      console.log("[SIM] similar_examples", { ms: Math.round(tEx1 - tEx0), count: similarExamples.length });
    } else {
      console.log("[SIM] skipped_for_call");
    }

    // Build prompt (unchanged logic; we only log sizes)
    let enhancedPrompt = persona.initial_prompt;

    if (similarExamples.length > 0) {
      enhancedPrompt += "\n\nHere are some examples of how you should respond based on your training:\n";
      similarExamples.forEach((example, index) => {
        enhancedPrompt += `\nExample ${index + 1}:\n`;
        enhancedPrompt += `User: ${example.user_input}\n`;
        enhancedPrompt += `You: ${example.expected_response}\n`;
        if (example.context) {
          enhancedPrompt += `Context: ${example.context}\n`;
        }
      });
      enhancedPrompt += "\nNow respond to the current user message in a similar style and personality:\n";
    }

    const historyTurns = (recentConversations || []).length;
    const historyBytes = bytes(
      JSON.stringify((recentConversations || []).map((m: any) => ({ r: m.role, c: m.content })))
    );
    const promptBytes = bytes(enhancedPrompt);

    console.log("[PROMPT] sizes", {
      promptBytes,
      historyTurns,
      historyBytes,
      userMsgChars: message?.length ?? 0,
    });

    const messagesForAI = [
      { role: "system" as const, content: enhancedPrompt },
      ...(recentConversations || []).map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    // ---------- Build generation options ----------
    const generationOptions = isCall
      ? {
        model: aiSdkOpenai("gpt-4o-mini"),       // Faster, cheaper model for calls
        messages: messagesForAI,
        maxTokens: CALL_MAX_TOKENS,
        temperature: CALL_TEMPERATURE,
        stop: CALL_STOP,
      }
      : {
        model: aiSdkOpenai("gpt-4o-mini"),
        messages: messagesForAI,
      };

    // LLM timing
    const tLLM0 = ms();
    const result = await generateText(generationOptions as any);
    const tLLM1 = ms();

    let aiResponse = result.text ?? "";
    const usage = (result as any).usage || {};

    console.log("[LLM] done", {
      ms: Math.round(tLLM1 - tLLM0),
      promptBytes,
      historyTurns,
      historyBytes,
      aiChars: aiResponse.length,
      usage,
    });
    console.log("[CHAT] assistant_sample", aiResponse.slice(0, 160));

    // ---------- Post-cap for calls (guard rails) ----------
    let cappedMeta: any = { applied: false };

    // Persist only for non-call (original behavior)
    if (!isCall) {
      try {
        const tStore0 = ms();
        await supabase.from("conversations").insert([
          { user_id: userId, persona_id: personaId, role: "user", content: message },
          { user_id: userId, persona_id: personaId, role: "assistant", content: aiResponse },
        ]);
        const tStore1 = ms();
        console.log("[DB] store_conversation", { ms: Math.round(tStore1 - tStore0) });
      } catch (err) {
        console.log("[DB] store_conversation_failed", err);
      }
    } else {
      // 1) remove emojis (voice adds no value, costs synth time)
      const cap0 = ms();
      const before = aiResponse.length;
      console.log("[CALL] pre_cap", { aiChars: before });

      console.log("Before Emojee strip", { aiResponse });
      aiResponse = stripEmojis(aiResponse);
      console.log("After Emojee strip", { aiResponse });

      const after = aiResponse.length;
      const cap1 = ms();
      console.log("[CALL] post_cap", { before, after, cap_ms: Math.round(cap1 - cap0) });
    }

    const res = NextResponse.json(
      {
        response: aiResponse,
        training_examples_used: similarExamples.length,
      },
      { status: 200 },
    );

    // Telemetry headers for client-side logs
    res.headers.set("x-llm-ms", String(Math.round(tLLM1 - tLLM0)));
    res.headers.set("x-llm-ai-chars", String(aiResponse.length));
    res.headers.set("x-llm-prompt-bytes", String(promptBytes));
    res.headers.set("x-llm-history-turns", String(historyTurns));
    res.headers.set("x-llm-history-bytes", String(historyBytes));
    if (usage?.promptTokens) res.headers.set("x-llm-prompt-tokens", String(usage.promptTokens));
    if (usage?.completionTokens) res.headers.set("x-llm-completion-tokens", String(usage.completionTokens));
    // end-to-end server time (request entry to response build)
    res.headers.set("x-req-ms", String(Math.round(ms() - tReq0)));
    return res;
  } catch (error: any) {
    console.error("[CHAT] error:", error?.message || error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
