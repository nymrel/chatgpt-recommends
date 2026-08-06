/* ChatGPT Recommendation Check — Full Report ($9).
   Writes all eight buyer-intent prompts from the details entered into the free
   checker, reports the verdict for the answers actually pasted, and ships the
   fix checklist as files. Built in the buyer's browser, from their own inputs.

   The free tool never queries an AI and neither does this. Prompts the buyer
   has not run are reported as not run — never estimated, never scored. */
(function () {
  "use strict";

  var JB = window.JB;
  if (!JB || !JB.pro) return;
  var esc = JB.pro.escapeHtml;

  var TOOL_URL = "https://nymrel.com/tools/chatgpt-recommends";

  var AI_AGENTS = [
    "GPTBot", "OAI-SearchBot", "ChatGPT-User",
    "ClaudeBot", "Claude-SearchBot", "Claude-User",
    "PerplexityBot", "Perplexity-User",
    "Google-Extended", "Applebot-Extended"
  ];

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function isoDate(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }

  /* ============================================================
     reading the free checker
     ============================================================ */

  function el(id) { return document.getElementById(id); }
  function valOf(id) { var e = el(id); return e ? String(e.value || "").trim() : ""; }

  function inputs() {
    var api = window.JBRecommends;
    if (api && typeof api.getInputs === "function") {
      try {
        var v = api.getInputs();
        if (v && typeof v.name === "string") {
          return { name: v.name, city: v.city || "", cat: v.cat || "", comp: v.comp || [] };
        }
      } catch (e) { /* fall through to reading the page directly */ }
    }
    if (!el("bizName")) return null;
    return {
      name: valOf("bizName"),
      city: valOf("bizCity"),
      cat: valOf("bizCat"),
      comp: String(valOf("bizComp")).split(",").map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 3)
    };
  }

  function answers() {
    var api = window.JBRecommends;
    if (api && typeof api.getAnswers === "function") {
      try {
        var a = api.getAnswers();
        if (Object.prototype.toString.call(a) === "[object Array]") return a;
      } catch (e) { /* fall through */ }
    }
    return [valOf("paste1"), valOf("paste2"), valOf("paste3")];
  }

  /* Mirrors the free checker's scorer, and is only used when the page has not
     exposed its own. Same rules: 0 not mentioned, 60 mentioned, 100 leads,
     15 mentioned inside negative context. */
  function localNormalize(s) {
    return String(s == null ? "" : s)
      .toLowerCase()
      .replace(/[‘’“”]/g, "'")
      .replace(/[^a-z0-9&'\s-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  var LOCAL_NEG = /(^|[^a-z])(scams?|avoid|beware|frauds?|fraudulent|complaints?|lawsuits?|not\s+recommend(ed)?|poor\s+reviews|bad\s+reviews|mixed\s+reviews)([^a-z]|$)/;

  function localFind(norm, raw) {
    var n = localNormalize(raw);
    if (!n) return null;
    var variants = [n];
    if (n.indexOf("the ") === 0) variants.push(n.slice(4));
    var best = null;
    variants.forEach(function (v) {
      if (!v) return;
      var re = new RegExp("(^|[^a-z0-9])" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^a-z0-9]|$)");
      var m = re.exec(norm);
      if (m) {
        var pos = m.index + m[1].length;
        if (!best || pos < best.pos) best = { pos: pos, len: v.length };
      }
    });
    return best;
  }

  function localScoreAnswer(answer, nameRaw, competitors) {
    var norm = localNormalize(answer);
    if (!norm) return { status: "idle", score: null };
    var hit = localFind(norm, nameRaw);
    if (!hit) return { status: "absent", score: 0 };
    var around = norm.slice(Math.max(0, hit.pos - 120), Math.min(norm.length, hit.pos + hit.len + 120));
    if (LOCAL_NEG.test(around)) return { status: "negative", score: 15 };
    var compPos = -1;
    (competitors || []).forEach(function (c) {
      var f = localFind(norm, c);
      if (f && (compPos === -1 || f.pos < compPos)) compPos = f.pos;
    });
    if (hit.pos < norm.length / 4 && (compPos === -1 || hit.pos < compPos)) return { status: "leads", score: 100 };
    return { status: "mentioned", score: 60 };
  }

  function localBand(score) {
    if (score < 25) return { key: "bad", word: "Invisible to AI", reading: "Right now, when your customers ask AI who to hire, your name doesn't come up." };
    if (score < 55) return { key: "warn", word: "On the radar", reading: "You get a mention, but you're one of the crowd — not the answer." };
    if (score < 80) return { key: "brass", word: "In the running", reading: "You show up and make the shortlist. Close, but not locked in." };
    return { key: "ok", word: "Recommended", reading: "When customers ask, AI points them to you. That's the goal." };
  }

  function scorer() {
    var api = window.JBRecommends;
    return (api && typeof api.scoreAnswer === "function") ? api.scoreAnswer : localScoreAnswer;
  }
  function bander() {
    var api = window.JBRecommends;
    return (api && typeof api.band === "function") ? api.band : localBand;
  }

  /* ============================================================
     the eight prompts
     ============================================================ */

  function plural(s) {
    if (!s) return s;
    if (/[^aeiou]y$/i.test(s)) return s.slice(0, -1) + "ies";
    if (/(s|x|z|ch|sh)$/i.test(s)) return s + "es";
    return s + "s";
  }

  /* Prompts 1–3 are the free ones, written exactly as the free tool writes
     them. 4–8 are the paid ones, in the same plain style — the way a customer
     types, not the way a marketer writes. */
  function buildPrompts(v) {
    var rival = (v.comp && v.comp[0]) || "";
    return [
      { n: 1, label: "Best in town", free: true, text: "best " + v.cat + " in " + v.city },
      { n: 2, label: "Who should I hire", free: true, text: "I need a " + v.cat + " in " + v.city + " — who should I hire and why?" },
      { n: 3, label: "Legit check", free: true, text: "is " + v.name + " legit?" },
      { n: 4, label: "Reviews check", free: false, text: "what are the reviews like for " + v.name + " in " + v.city + "?" },
      {
        n: 5, label: "Head-to-head vs your competitor", free: false,
        text: rival
          ? v.name + " vs " + rival + " — which one should I go with?"
          : v.name + " vs the other " + plural(v.cat) + " in " + v.city + " — how do they compare?"
      },
      { n: 6, label: "Top-3 shortlist", free: false, text: "give me a shortlist of the top 3 " + plural(v.cat) + " in " + v.city },
      { n: 7, label: "Worth-it check", free: false, text: "is " + v.name + " worth it?" },
      { n: 8, label: "Where should I go", free: false, text: "where should I go for a good " + v.cat + " in " + v.city + "?" }
    ];
  }

  var STATUS = {
    leads:     { text: "Leads the answer", cls: "ok" },
    mentioned: { text: "Mentioned",        cls: "warn" },
    absent:    { text: "Not mentioned",    cls: "bad" },
    negative:  { text: "Negative context", cls: "bad" },
    notrun:    { text: "Not run yet",      cls: "" }
  };

  /* Attaches the buyer's real result to each prompt: the free three from the
     page, prompts 4–8 from the boxes this module opens once unlocked. A prompt
     with nothing pasted is "not run yet" — never guessed, never estimated. */
  function evaluate(v) {
    var prompts = buildPrompts(v);
    var pasted = answers();
    var score = scorer();
    var run = [];

    prompts.forEach(function (p, i) {
      var answer = p.free
        ? String(pasted[i] || "").trim()
        : String((proAnswers && proAnswers[p.n]) || "").trim();
      if (!answer) {
        p.status = "notrun";
        p.score = null;
        return;
      }
      var r = score(answer, v.name, v.comp);
      if (!r || r.status === "idle" || r.score === null || r.score === undefined) {
        p.status = "notrun";
        p.score = null;
        return;
      }
      p.status = r.status;
      p.score = r.score;
      run.push(r.score);
    });

    var overall = run.length ? Math.round(run.reduce(function (a, b) { return a + b; }, 0) / run.length) : null;
    return {
      prompts: prompts,
      runCount: run.length,
      overall: overall,
      band: overall === null ? null : bander()(overall)
    };
  }

  /* ============================================================
     the fix checklist
     ============================================================ */

  function llmsTemplate(v) {
    return "# " + v.name + "\n\n" +
      "> " + v.name + " is a " + v.cat + " in " + v.city + ". One more sentence on who you work with.\n\n" +
      "## Key pages\n" +
      "- [Home](https://yoursite.com/): what we do, in plain words.\n" +
      "- [About](https://yoursite.com/about): who runs it and since when.\n" +
      "- [Pricing](https://yoursite.com/pricing): what it costs.\n" +
      "- [Contact](https://yoursite.com/contact): email, phone, hours, area covered.\n\n" +
      "## Contact\n" +
      "- [hello@yoursite.com](mailto:hello@yoursite.com)\n";
  }

  function faqTemplate(v) {
    function q(name, answer) {
      return "    {\n" +
        '      "@type": "Question",\n' +
        '      "name": ' + JSON.stringify(name) + ",\n" +
        '      "acceptedAnswer": { "@type": "Answer", "text": ' + JSON.stringify(answer) + " }\n" +
        "    }";
    }
    return "<script type=\"application/ld+json\">\n" +
      "{\n" +
      '  "@context": "https://schema.org",\n' +
      '  "@type": "FAQPage",\n' +
      '  "mainEntity": [\n' +
      [
        q("What does " + v.name + " do?", "Replace with the same sentence that is printed on the page."),
        q("Where is " + v.name + " based?", v.name + " is based in " + v.city + ". Add the areas you cover."),
        q("How much does " + v.name + " charge?", "A real number or a real range. Print it on the page too."),
        q("Is " + v.name + " taking new customers?", "Yes or no, plus how to get in touch.")
      ].join(",\n") + "\n" +
      "  ]\n" +
      "}\n" +
      "<\/script>";
  }

  function robotsTemplate() {
    return "User-agent: *\nAllow: /\n\n" +
      "# AI assistants and AI search crawlers — allowed on purpose\n" +
      AI_AGENTS.map(function (a) { return "User-agent: " + a + "\nAllow: /"; }).join("\n\n") +
      "\n\nSitemap: https://yoursite.com/sitemap.xml\n";
  }

  function entityTemplate(v) {
    return "{\n" +
      '  "@context": "https://schema.org",\n' +
      '  "@type": "LocalBusiness",\n' +
      '  "name": ' + JSON.stringify(v.name) + ",\n" +
      '  "description": ' + JSON.stringify(v.cat + " in " + v.city) + ",\n" +
      '  "url": "https://yoursite.com",\n' +
      '  "telephone": "+1-555-000-0000",\n' +
      '  "address": {\n' +
      '    "@type": "PostalAddress",\n' +
      '    "streetAddress": "123 Main St",\n' +
      '    "addressLocality": ' + JSON.stringify(v.city) + ",\n" +
      '    "addressRegion": "",\n' +
      '    "postalCode": "",\n' +
      '    "addressCountry": ""\n' +
      "  },\n" +
      '  "sameAs": [\n' +
      '    "https://www.google.com/maps/place/your-listing",\n' +
      '    "https://www.linkedin.com/company/your-business",\n' +
      '    "https://www.instagram.com/yourbusiness"\n' +
      "  ]\n" +
      "}";
  }

  function checklist(v) {
    return [
      {
        title: "1 · llms.txt at your site root",
        why: "A short, curated map of your site. It is what an assistant reads to work out which of your pages are worth reading in full instead of guessing from your navigation.",
        steps: [
          "Save the file below as llms.txt and upload it so it loads at https://yoursite.com/llms.txt.",
          "Use absolute URLs. A relative link is useless to a crawler that found the file on its own.",
          "Keep it short — four to twelve links beats fifty.",
          "Rebuild it after a redesign or a migration. A stale map is worse than none."
        ],
        code: llmsTemplate(v),
        codeLabel: "llms.txt"
      },
      {
        title: "2 · FAQ schema with the questions you actually get asked",
        why: "Marked-up questions and answers are the easiest thing on your site for an assistant to hand back to a customer, because the answer is already scoped to a question. The four below map to the prompts in this report.",
        steps: [
          "Every question and answer in the markup must also be visible on the page. Hidden-only FAQ markup breaks Google's structured-data guidelines and can get your rich results pulled.",
          "Answer in full sentences. A one-word answer is not quotable.",
          "Paste the block into the <head> of the page that shows the FAQ.",
          "Validate it at search.google.com/test/rich-results."
        ],
        code: faqTemplate(v),
        codeLabel: "FAQPage JSON-LD"
      },
      {
        title: "3 · AI-bot allowlist in robots.txt",
        why: "AI crawlers read this file first. A wildcard rule is treated conservatively by some of them, so naming each agent removes the ambiguity.",
        steps: [
          "If robots.txt already exists, merge these blocks into it — do not replace the file.",
          "Point the Sitemap: line at a sitemap that actually loads.",
          "Check it in a private window afterwards: it should display as plain text, not download."
        ],
        code: robotsTemplate(),
        codeLabel: "robots.txt"
      },
      {
        title: "4 · Entity proof",
        why: "This is the one with no shortcut. An assistant will not confidently name a business it cannot pin down. Your details have to match everywhere, your profiles have to be claimed as yours, and someone other than you has to have said your name in public.",
        steps: [
          "Write your name, address and phone once, exactly, and make every listing identical — site footer, schema, Google Business Profile, Apple Business Connect, socials, directories. Punctuation included.",
          "Claim your profiles and list them in a sameAs array so they are provably yours (block below).",
          "Publish real reviews as plain text on your own page — name, date, and the actual words. Reviews trapped inside a third-party JavaScript widget are invisible to a crawler.",
          "Get named on sites you do not own: your trade's main directory, the local chamber, suppliers' and partners' pages, past clients. Start with the free listings you can claim today.",
          "Never write a review yourself and never mark up a review that is not shown on the page. Both break the guidelines, and both are the kind of thing an assistant surfaces later."
        ],
        code: entityTemplate(v),
        codeLabel: "LocalBusiness JSON-LD with sameAs",
        note: "No one can promise you a mention, a citation, or coverage — this is steady work, not a task with a finish line."
      }
    ];
  }

  /* ============================================================
     files
     ============================================================ */

  function pre(text) { return "<pre>" + esc(text) + "</pre>"; }

  function reportHtml(v, ev, recheck) {
    var body = "";

    /* --- verdict --- */
    body += "<h2>Where you stand today</h2>";
    if (ev.overall === null) {
      body +=
        "<p><span class=\"pill\">No score yet</span> &nbsp; You have not pasted any answers into the free checker, " +
        "so there is nothing to score. Everything below is still ready to use: the eight prompts, and the fix checklist.</p>";
    } else {
      var cls = ev.band.key === "ok" ? "ok" : (ev.band.key === "bad" ? "bad" : "warn");
      body +=
        '<p><span class="pill ' + cls + '">' + esc(ev.overall + " / 100 · " + ev.band.word) + "</span> &nbsp; " +
        esc("based on the " + ev.runCount + " of 8 prompts you have run") + "</p>" +
        "<p>" + esc(ev.band.reading) + "</p>" +
        "<p>The score is the average of the answers you actually pasted. The other " +
        esc(String(8 - ev.runCount)) + " prompts are listed below as not run — nothing here estimates them.</p>";
    }

    body +=
      "<table><thead><tr><th class=\"num\">#</th><th>Prompt</th><th>Result</th><th class=\"num\">Score</th></tr></thead><tbody>" +
      ev.prompts.map(function (p) {
        var s = STATUS[p.status] || STATUS.notrun;
        return "<tr>" +
          '<td class="num">' + esc(String(p.n)) + "</td>" +
          "<td>" + esc(p.label) + "</td>" +
          '<td><span class="pill ' + s.cls + '">' + esc(s.text) + "</span></td>" +
          '<td class="num">' + (p.score === null ? "—" : esc(String(p.score))) + "</td>" +
          "</tr>";
      }).join("") +
      "</tbody></table>" +
      "<p>How the scorer reads an answer: not mentioned scores 0, a plain mention scores 60, " +
      "leading the answer scores 100, and a mention wrapped in negative wording scores 15.</p>";

    /* --- the eight prompts --- */
    body +=
      "<h2>All eight prompts</h2>" +
      "<p>Run each one in ChatGPT, Claude, Perplexity or Gemini and paste the answer back into the free checker to score it. " +
      "Start a fresh chat for each prompt — an assistant that has already been told about you in the same conversation will name you for that reason alone. " +
      "Answers vary between assistants, between sessions, and by location, so a single run is a sample, not a measurement.</p>" +
      ev.prompts.map(function (p) {
        var s = STATUS[p.status] || STATUS.notrun;
        return '<div class="item">' +
          '<p class="rank">' + esc("Prompt " + (p.n < 10 ? "0" + p.n : p.n) + " · " + (p.free ? "free tier" : "full report")) + "</p>" +
          "<h3>" + esc(p.label) + "</h3>" +
          pre(p.text) +
          '<p><span class="pill ' + s.cls + '">' + esc(s.text) + "</span>" +
          (p.score === null ? "" : " &nbsp; " + esc(p.score + "/100")) + "</p>" +
          (p.status === "notrun"
            ? "<p>Not run yet. Copy the prompt above, ask an assistant, and paste what it says back into the free checker.</p>"
            : "") +
          "</div>";
      }).join("");

    /* --- fix checklist --- */
    body +=
      "<h2>The fix checklist</h2>" +
      "<p>Four things decide whether an assistant can name you with confidence. Replace the placeholder values — everything below is written for " +
      esc(v.name) + ", a " + esc(v.cat) + " in " + esc(v.city) + ".</p>" +
      checklist(v).map(function (c) {
        return '<div class="item">' +
          "<h3>" + esc(c.title) + "</h3>" +
          "<p>" + esc(c.why) + "</p>" +
          "<ol>" + c.steps.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("") + "</ol>" +
          "<p><strong>" + esc(c.codeLabel) + "</strong></p>" +
          pre(c.code) +
          (c.note ? "<p>" + esc(c.note) + "</p>" : "") +
          "</div>";
      }).join("");

    /* --- recheck --- */
    body +=
      "<h2>The 30-day recheck</h2>" +
      "<p><code>recheck.ics</code> in this download is a calendar event on <strong>" + esc(recheck.toLocaleDateString()) +
      "</strong>, and <code>baseline.json</code> is today's result saved. That is the whole mechanism: a reminder you set for yourself, " +
      "plus a starting point to compare against. Nobody re-runs the prompts for you and nothing watches the assistants on your behalf.</p>" +
      "<ol>" +
      "<li>Work the fix checklist above.</li>" +
      "<li>On " + esc(recheck.toLocaleDateString()) + ", run the same eight prompts again — same wording, fresh chats.</li>" +
      "<li>Paste the first three back into the free checker, then open <code>baseline.json</code> beside it and compare prompt by prompt.</li>" +
      "</ol>" +

      "<h2>What this report does not do</h2>" +
      "<p>This tool never queries ChatGPT or any other assistant. You run the prompts; it writes them and scores the text you paste back. " +
      "That is deliberate — you see exactly what a customer sees, and nothing is simulated on your behalf.</p>" +
      "<p>Nothing here promises that an assistant will mention you, recommend you, rank you, or send you traffic. No one can promise that. " +
      "What the checklist removes is the technical and evidential reason for being skipped or described wrongly.</p>";

    return JB.pro.reportHtml({
      kicker: "ChatGPT Recommendation Check · Full Report",
      title: "AI recommendation report — " + v.name,
      lede: ev.overall === null
        ? "All eight prompts, ready to run. No answers pasted yet, so nothing is scored."
        : ev.overall + "/100 — " + ev.band.word + ", from " + ev.runCount + " of 8 prompts run.",
      body: body
    });
  }

  function promptsTxt(ev) {
    return ev.prompts.map(function (p) { return p.text; }).join("\n") + "\n";
  }

  function baselineJson(v, ev, recheck) {
    return JSON.stringify({
      tool: "chatgpt-recommends",
      artifact: "full-report-baseline",
      version: 1,
      generatedAt: new Date().toISOString(),
      recheckOn: isoDate(recheck),
      business: { name: v.name, city: v.city, category: v.cat, competitors: v.comp },
      score: ev.overall,
      band: ev.band ? ev.band.word : null,
      promptsRun: ev.runCount,
      promptsTotal: 8,
      prompts: ev.prompts.map(function (p) {
        return {
          n: p.n,
          label: p.label,
          text: p.text,
          tier: p.free ? "free" : "full-report",
          run: p.status !== "notrun",
          status: p.status,
          score: p.score
        };
      }),
      note: "Scores come only from answers pasted into the checker by hand. Prompts marked run:false were never asked and are not estimated. Re-run the same prompts on recheckOn and compare against this file."
    }, null, 2) + "\n";
  }

  function readmeTxt(v, ev, recheck) {
    return [
      "ChatGPT Recommendation Check — Full Report",
      "Built " + new Date().toLocaleString() + " for " + v.name + " (" + v.cat + ", " + v.city + ")",
      ev.overall === null
        ? "No answers pasted yet, so there is no score in this download."
        : "Your score today: " + ev.overall + "/100 (" + ev.band.word + ") from " + ev.runCount + " of 8 prompts run",
      "",
      "  full-report.html  Open in a browser. All 8 prompts, your result for the ones you",
      "                    have run, and the fix checklist with real snippets. Print for a PDF.",
      "  prompts.txt       The 8 prompts, one per line. Paste them straight into ChatGPT,",
      "                    Claude, Perplexity or Gemini.",
      "  recheck.ics       Double-click to add a calendar reminder on " + recheck.toLocaleDateString() + ".",
      "  baseline.json     Today's result saved, per prompt, so the second run is a real",
      "                    before-and-after.",
      "  README.txt        This file.",
      "",
      "How to run the prompts: one per fresh chat. An assistant that has already been",
      "told about you earlier in the same conversation will name you for that reason",
      "alone, which tells you nothing. Answers also vary between assistants, between",
      "sessions, and by location — one run is a sample, not a measurement.",
      "",
      "About the scores: only answers you paste in by hand are scored. Prompts 04-08",
      "have no paste box in the free checker, so they are reported as not run rather",
      "than guessed. This tool never queries ChatGPT or any other assistant.",
      "",
      "About the 30-day recheck: it is the calendar reminder plus the saved baseline.",
      "Nobody runs the prompts for you and nothing monitors the assistants on your",
      "behalf. You run them again on the date and compare against baseline.json.",
      "",
      "Everything here was generated in your browser from what you typed into the free",
      "checker. Nothing was uploaded anywhere.",
      "",
      "Questions: contact@nymrel.com",
      ""
    ].join("\n");
  }

  function slug(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report";
  }

  /* ============================================================
     unlocking prompts 4–8 on the page

     The free tool has paste boxes for the first three prompts only. Without
     somewhere to paste the other five, buying the report would buy five prompt
     strings — so unlocking opens the same paste-and-score loop on cards 4–8.
     The free verdict box is left exactly as it was, reading the free three.
     ============================================================ */

  var PRO_ANSWER_KEY = "jbt.recommends.pro.answers";

  function loadProAnswers() {
    try {
      var raw = JSON.parse(localStorage.getItem(PRO_ANSWER_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function saveProAnswers(map) {
    try { localStorage.setItem(PRO_ANSWER_KEY, JSON.stringify(map)); } catch (e) { /* ignore */ }
  }

  var proAnswers = loadProAnswers();

  function setStatusPill(card, status) {
    var meta = STATUS[status] || STATUS.notrun;
    var wrap = card.querySelector(".pc-chipwrap");
    if (!wrap) return;
    wrap.innerHTML = '<span class="pill ' + meta.cls + '">' + esc(meta.text) + "</span>";
  }

  function scoreProCard(card, prompt, v) {
    var box = card.querySelector(".pc-paste");
    var text = box ? String(box.value || "").trim() : "";
    if (!text) {
      setStatusPill(card, "notrun");
      return;
    }
    var r = scorer()(text, v.name, v.comp);
    setStatusPill(card, r && r.status && r.status !== "idle" ? r.status : "notrun");
  }

  /* One line under the delivery panel: the average across every prompt the
     buyer has actually run, free and Pro. Never an estimate for unrun ones. */
  function renderProSummary() {
    var host = document.getElementById("proAllEight");
    if (!host) return;
    var v = inputs();
    if (!v || !v.name) { host.textContent = ""; return; }
    var ev = evaluate(v);
    if (!ev.runCount) {
      host.textContent = "No answers pasted yet. Copy a prompt, run it, and paste the answer back.";
      return;
    }
    host.textContent = "Across the " + ev.runCount + " of 8 prompts you have run: " +
      ev.overall + "/100 — " + ev.band.word + ".";
  }

  function unlockLockedCards() {
    var cards = document.querySelectorAll(".prompt-card.locked");
    if (!cards.length) return;
    var v = inputs();
    if (!v) return;
    var prompts = buildPrompts(v).filter(function (p) { return !p.free; });

    Array.prototype.forEach.call(cards, function (card, i) {
      var prompt = prompts[i];
      if (!prompt || card.getAttribute("data-pro-unlocked")) return;
      card.setAttribute("data-pro-unlocked", "1");
      card.classList.remove("locked");

      var row = document.createElement("div");
      row.className = "pc-prompt";
      row.innerHTML =
        '<span class="pc-q"></span>' +
        '<button class="btn btn-sm pc-copy" type="button">Copy prompt</button>';
      row.querySelector(".pc-q").textContent = prompt.text;

      var box = document.createElement("textarea");
      box.className = "pc-paste";
      box.setAttribute("aria-label", "Paste the answer to prompt " + prompt.n);
      box.placeholder = "Paste the answer here";
      box.value = proAnswers[prompt.n] || "";

      var desc = card.querySelector(".pc-desc");
      if (desc && desc.nextSibling) card.insertBefore(row, desc.nextSibling);
      else card.appendChild(row);
      card.insertBefore(box, row.nextSibling);

      row.querySelector(".pc-copy").addEventListener("click", function () {
        JB.copy(prompt.text, "Prompt copied — paste it into ChatGPT, then bring the answer back");
      });

      box.addEventListener("input", function () {
        proAnswers[prompt.n] = box.value;
        saveProAnswers(proAnswers);
        scoreProCard(card, prompt, inputs() || v);
        renderProSummary();
      });

      scoreProCard(card, prompt, v);
    });

    var cta = document.querySelector(".locked-unlock");
    if (cta) cta.style.display = "none";

    renderProSummary();
  }

  /* Editing the business details rewrites every prompt, so the unlocked cards
     have to follow along the same way the free three do. Listening on the
     document in the capture phase catches typing, Reset, and Try an example
     alike — the last two set field values in code and fire no input event. */
  function syncUnlockedCards() {
    var v = inputs();
    if (!v) return;
    var prompts = buildPrompts(v).filter(function (p) { return !p.free; });
    Array.prototype.forEach.call(document.querySelectorAll("[data-pro-unlocked]"), function (card, i) {
      var prompt = prompts[i];
      if (!prompt) return;
      var q = card.querySelector(".pc-q");
      if (q) q.textContent = prompt.text;
      scoreProCard(card, prompt, v);
    });
    renderProSummary();
  }

  var syncTimer = null;
  function scheduleSync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncUnlockedCards, 60);
  }

  function watchInputs() {
    if (document.body.getAttribute("data-pro-watching")) return;
    document.body.setAttribute("data-pro-watching", "1");
    ["input", "click", "change"].forEach(function (evt) {
      document.addEventListener(evt, scheduleSync, true);
    });
  }

  /* ============================================================
     registration
     ============================================================ */

  JB.pro.register("recommends-pro", {
    label: "Full Report",
    filenameLabel: "the report",
    summary: "Prompts 04–08 are now open above with their own paste boxes, and the report is yours to download.",
    contents: [
      "Prompts 04–08 unlocked on this page — copy each one, run it, paste the answer back, and it scores like the free three",
      "full-report.html — all 8 buyer-intent prompts written out, ready to copy, printable to PDF",
      "Your verdict and a per-prompt breakdown for the answers you have pasted — prompts you have not run are marked not run, never estimated",
      "The fix checklist with real snippets: llms.txt, FAQ schema, an AI-bot robots allowlist, and entity proof",
      "prompts.txt — the 8 prompts, one per line, ready to paste into ChatGPT, Claude, Perplexity or Gemini",
      "recheck.ics — a calendar reminder 30 days out, with today's score in it",
      "baseline.json — today's result per prompt, so the second run is a real before-and-after",
      "README.txt — what each file is and how to run the prompts properly"
    ],
    extraHtml: '<p class="pro-note" id="proAllEight" style="margin:0"></p>',
    onRender: function () {
      unlockLockedCards();
      watchInputs();
      syncUnlockedCards();
    },
    ready: function () {
      var v = inputs();
      if (!v) return "Open the checker above and fill in your details first — the eight prompts are built from them.";
      if (!v.name) return "Add your business name above — prompts 3, 4, 5 and 7 ask about you by name.";
      if (!v.city) return "Add your city or area above — the prompts ask \"in {your city}\".";
      if (!v.cat) return "Add what you do above — something like \"wedding photographer\" or \"coffee roaster\".";
      return "";
    },
    build: function () {
      var v = inputs();
      if (!v || !v.name || !v.city || !v.cat) throw new Error("your details are not filled in yet");

      var ev = evaluate(v);
      var recheck = new Date();
      recheck.setDate(recheck.getDate() + 30);
      recheck.setHours(10, 0, 0, 0);

      var scoreLine = ev.overall === null
        ? "You had not pasted any answers yet when this reminder was made."
        : "30 days ago you scored " + ev.overall + "/100 (" + ev.band.word + ") from " + ev.runCount + " of 8 prompts.";

      var ics = JB.pro.icsFile({
        date: recheck,
        summary: "Re-run the AI recommendation prompts — " + v.name,
        description:
          scoreLine + "\n" +
          "Run the same 8 prompts again (they are in prompts.txt), one per fresh chat, then compare against baseline.json.\n" +
          "Paste the first three back into the free checker to re-score them.\n" +
          "This is a reminder you set for yourself; nothing is running the prompts on your behalf.\n" +
          "Checker: " + TOOL_URL,
        url: TOOL_URL
      });

      return {
        filename: "ai-recommendation-report-" + slug(v.name) + "-" + isoDate(new Date()) + ".zip",
        toast: "Full Report downloaded — start with README.txt",
        files: [
          { name: "full-report.html", text: reportHtml(v, ev, recheck) },
          { name: "prompts.txt", text: promptsTxt(ev) },
          { name: "recheck.ics", text: ics },
          { name: "baseline.json", text: baselineJson(v, ev, recheck) },
          { name: "README.txt", text: readmeTxt(v, ev, recheck) }
        ]
      };
    }
  });
})();
