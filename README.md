# ChatGPT Recommendation Check

Find out whether ChatGPT recommends your business. Ask the questions your customers
ask, paste what it says back, and get a scored verdict.

**Use it:** https://nymrel.com/tools/chatgpt-recommends

## What it does

People ask an assistant for a plumber, a gym, a supplier — and it names a few. This
tool writes three buyer-intent prompts from your business details, you run them in
ChatGPT yourself, and you paste the answers back. It scores what came out: whether you
were named, how you were described, and who got named instead.

No account, no API key, no email gate.

## Run it locally

No build step and no dependencies. It is a static page.

```
git clone https://github.com/nymrel/chatgpt-recommends.git
cd chatgpt-recommends
python3 -m http.server 8000
```

Then open http://localhost:8000/tools/chatgpt-recommends/

The page loads its stylesheet, script, and fonts from absolute paths (`/assets/...`),
so it needs a server rooted at the repo folder. Opening the HTML file straight from
disk will render unstyled.

## What is in here

| Path | What it is |
| --- | --- |
| `tools/chatgpt-recommends/index.html` | The whole tool — markup, copy, and logic |
| `assets/site.css`, `assets/site.js` | Shared styles and behavior across the Nymrel tools |
| `assets/pro/` | The paid-tier module, as shipped |
| `assets/checkout-config.js` | The checkout registry template |
| `assets/fonts/` | The three fonts the page uses |

`tools/chatgpt-recommends/index.html` is byte-for-byte the file nymrel.com serves.

## A note on the paid tier

The page offers a paid report. `assets/checkout-config.js` here is the committed
template with no payment links set, so in a local copy the upgrade button falls back
to email. The free check runs three prompts and gives you a scored verdict on its own.

## Privacy

Everything you paste stays in your browser. The tool does not call ChatGPT, and it
makes no server calls — you run the questions yourself and bring the answers back.

## Credits

Instrument Serif, Instrument Sans, and IBM Plex Mono are used under the SIL Open
Font License.

## Who built it

[Nymrel](https://nymrel.com) — a software studio that builds and runs its own products.

## License

MIT. See [LICENSE](LICENSE).
