export default function Home() {
  return (
    <>
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <p className="text-xl font-bold tracking-tight">LaughterMaster</p>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Top 10 of the day
        </h1>
        <p className="mt-3 text-base text-black/70">
          Jokes are coming soon. Check back shortly!
        </p>
      </main>
    </>
  );
}
