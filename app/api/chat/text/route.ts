import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { auth } from "@/lib/firebaseAdmin"
import { findSimilarDialogExamples } from "@/lib/embeddings"
import { getUserIdFromRequest } from "@/lib/extractUserFromRequest"
import { queueNotificationToSQS } from "@/lib/notifications"
import { openai, chatModel } from "@/lib/openai"

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
    const parsed = JSON.parse(process.env.CALL_STOP || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    console.warn("Invalid CALL_STOP env format, falling back to defaults");
    return ["\n\n", "User:", "You:", "ASSISTANT:"];
  }
})();

// Helper: strip common emoji/pictographs (keeps ASCII + basic punctuation)
const stripEmojis = (s: string) =>
  s.replace(
    /[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{200D}\u{2640}-\u{2642}\u{2600}-\u{27BF}]/gu,
    ""
  );

// Helper: strip % $ # and other non-alphanumeric (except spaces and .,!?)
const stripSpecialChars = (s: string) =>
  s.replace(
    /[%$#@&*(){}/<>^~`|\\:;'"=+]/g, // removes unsafe symbols
    ""
  );


function shouldUseInternetSearch(userMessage: string): boolean {
  // Load from env, or fallback to defaults
  const triggers =
    process.env.SEARCH_TRIGGER_KEYWORDS?.split(",").map((s) => s.trim().toLowerCase()) || [
      "latest",
      "today",
      "current",
      "this week",
      "this month",
      "breaking",
      "recent",
      "news",
      "update",
      "score",
      "who won",
      "release date",
    ];

  const lower = userMessage.toLowerCase();
  return triggers.some((kw) => lower.includes(kw));
}

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

      // 5. Generate AI response using OpenAI
      let generationOptions: any;
      let maxTokens = Number(process.env.CALL_MAX_TOKENS) ?? 200

      if (isCall) {
        maxTokens = 1500
      }

      if ((chatModel as string).startsWith("gpt-5")) {
        // GPT-5 → no temperature, must use max_completion_tokens if you want a cap
        generationOptions = {
          model: chatModel as string,
          messages: messagesForAI,
          max_completion_tokens: maxTokens, // or undefined if you don't want to cap
        };
      } else {
        // GPT-4o → supports temperature and max_tokens
        generationOptions = {
          model: chatModel as string,
          messages: messagesForAI,
          max_tokens: maxTokens, // adjust as needed
          temperature: 0.8,
        };
      }

      const completion = await openai.chat.completions.create(generationOptions);

      const aiSeed = completion.choices[0].message?.content ?? "";

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
          { user_id: userId, persona_id: personaId, role: "assistant", content: aiSeed, is_read_status: false },
        ]);
        const tStore1 = ms();
        console.log("[DB] store_seed", { ms: Math.round(tStore1 - tStore0) });
      } catch (err) {
        console.log("[DB] store_seed_failed", err);
      }

      try {

        const results = await queueNotificationToSQS({
          userId: userId,
          title: `New message for you`,
          body: `${persona.name} sent a message`,
          type: "NEW_FEATURE_EVENT",
          data: {
            screen: "ChatList",
          },
          sendAt: new Date().toISOString() // Send immediately
        })

        console.log("Queued notifications:", userId, results)
      } catch (err) {
        console.error("Failed to queue notification:", err)
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
        //        .limit(isCall ? 6 : 20), // trimmed for calls
        .limit(700), // Adding more context so the user knows more
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

    // Add user personalization (name + conversation summary)
    const firstName = userProfile?.name
      ? userProfile.name.trim().split(" ")[0]
      : "hey"; // fallback if name missing

    // Add user personalization (name + conversation summary)
    if (firstName) {
      enhancedPrompt += `\n\nThe user's first name is ${firstName}. Use it naturally to personalize responses.`;
    }

    if (isCall) {
      enhancedPrompt += `\n\n Whenever it feels natural, add expressive cues such as [laughter], [sigh], [giggle], [excited], [laugh], [whisper], [pause].
      Only insert them where a human would realistically do so, and keep them subtle.
      Do not overuse them; at most 1–2 per short reply, and sometimes none.
      Format the cues in square brackets, e.g., "That was hilarious [laughter].`;
    }

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
    console.log("[CHAT] assistnt conversation type - isCall", isCall);

    console.log("[PROMPT] sizes", {
      promptBytes,
      historyTurns,
      historyBytes,
      userMsgChars: message?.length ?? 0,
      recentConversationLength: recentConversations?.length ?? 0
    });

    if (isCall) {
      enhancedPrompt = enhancedPrompt + "You must reply in ≤ 30 words."
    }

    if (recentConversations && recentConversations.length > 0) {
      const shortHistory = recentConversations
        .slice(-50) // keep last 5 turns for brevity
        .map((m: any) => `${m.role}: ${m.content}`)
        .join(" | ");
      enhancedPrompt += `\n\nRelevant past conversations: ${shortHistory}`;
    }

    const messagesForAI = [
      { role: "system" as const, content: enhancedPrompt },
      ...(recentConversations || []).map((msg: any) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      { role: "user" as const, content: message },
    ];

    // ---------- Build generation options ----------
    let generationOptions: any;
    let maxTokens = Number(process.env.CALL_MAX_TOKENS) ?? 200
    const useInternetSearch = shouldUseInternetSearch(message);

    if (isCall) {
      maxTokens = 250
    }

    // Add web search tool (can toggle with an env or request flag if desired)
    const internetTools = [
      {
        type: "web_search_preview",
        search_context_size: "low", // low / medium / high depending on cost vs depth
      },
    ];

    if (isCall) {
      // Check if model is GPT-5
      if ((chatModel as string).startsWith("gpt-5")) {
        generationOptions = {
          model: chatModel as string,
          messages: messagesForAI,
          max_completion_tokens: maxTokens, // ✅ GPT-5 expects this
          //          tools: internetTools
        };
      } else {
        generationOptions = {
          model: chatModel as string,
          messages: messagesForAI,
          max_tokens: maxTokens, // ✅ GPT-4 family expects this
          temperature: CALL_TEMPERATURE,
          stop: CALL_STOP,
          //          tools: internetTools
        };
      }
    } else {
      generationOptions = {
        model: chatModel as string,
        messages: messagesForAI,
        //        tools: internetTools
      };
    }

    // LLM timing
    const tLLM0 = ms();
    const completion = await openai.chat.completions.create(generationOptions);

    const tLLM1 = ms();

    let aiResponse = completion.choices[0].message?.content ?? "";

    const usage = (completion as any).usage || {};
    console.log("[LLM Raw] response", {
      model: completion.model,
      id: completion.id,
      created: completion.created,
      finish_reason: completion.choices[0].finish_reason,
      message: completion.choices[0].message,
      usage,
    });

    console.log("[LLM Choices] response:\n", JSON.stringify(completion.choices, null, 2));

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
        ]);
        await supabase.from("conversations").insert([
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

      aiResponse = stripSpecialChars(aiResponse);
      console.log("After Special CHars strip", { aiResponse });

      const after = aiResponse.length;
      const cap1 = ms();
      console.log("[CALL] post_cap", { before, after, cap_ms: Math.round(cap1 - cap0) });

      try {
        const tStore0 = ms();

        const { data, error } = await supabase
          .from("conversations")
          .insert([
            { user_id: userId, persona_id: personaId, role: "user", content: message, type: "voice" },
            { user_id: userId, persona_id: personaId, role: "assistant", content: aiResponse, type: "voice" },
          ])
          .select();

        if (error) {
          console.error("[DB] store_call insert_error", error);
        } else {
          console.log("[DB] store_call success", { rows: data.length });
        }

        const tStore1 = ms();
        console.log("[DB] store_call transcript", { ms: Math.round(tStore1 - tStore0) });
      } catch (err) {
        console.log("[DB] store_call transcript_failed", err);
      }

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
