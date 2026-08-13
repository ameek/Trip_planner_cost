export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card mt-6 p-6 text-center">
      <h3 className="font-display text-lg font-bold text-pine">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-moss">{body}</p>
    </div>
  )
}