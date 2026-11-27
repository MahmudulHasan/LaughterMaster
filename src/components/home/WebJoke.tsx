import { getWebJoke } from "@/server/webJoke/getWebJoke";

/**
 * "Joke from the web" (SPEC US-19): one joke from icanhazdadjoke.com,
 * labelled and credited, outside the community's lists and the top 10.
 * Renders nothing when no joke is available.
 */
export async function WebJoke() {
  const joke = await getWebJoke();
  if (!joke) return null;
  return (
    <section
      aria-labelledby="web-joke-heading"
      className="rounded-2xl border border-[#E3E5EA] bg-white p-6"
    >
      <h2 id="web-joke-heading" className="text-base font-semibold">
        Joke from the web
      </h2>
      <p className="mt-3 text-base leading-relaxed whitespace-pre-line text-[#15161A]">
        {joke.text}
      </p>
      <p className="mt-4 text-xs leading-relaxed text-black/60">
        From{" "}
        <a
          href={joke.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[#2B4FD8] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
        >
          icanhazdadjoke.com
        </a>
        . Not part of the top 10.
      </p>
    </section>
  );
}
