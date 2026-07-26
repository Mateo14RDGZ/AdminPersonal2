export default function OfflinePage() {
  return (
    <main className="screen-height flex items-center justify-center px-5">
      <div className="app-card max-w-sm p-6 text-center">
        <p className="text-4xl">📴</p>
        <h1 className="mt-3 text-xl font-semibold">Estás sin conexión</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted)]">
          Los gastos guardados desde el formulario rápido quedan pendientes y se
          sincronizan cuando vuelva internet.
        </p>
      </div>
    </main>
  );
}

