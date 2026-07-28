import { LoadingReveal } from "@/components/app-motion";

export default function AppLoading() {
  return (
    <LoadingReveal>
    <div className="space-y-5" aria-label="Cargando">
      <div className="skeleton h-8 w-40 rounded-xl" />
      <div className="skeleton h-40 rounded-[24px]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24 rounded-[18px]" />
        <div className="skeleton h-24 rounded-[18px]" />
      </div>
      <div className="space-y-2">
        <div className="skeleton h-16 rounded-[18px]" />
        <div className="skeleton h-16 rounded-[18px]" />
        <div className="skeleton h-16 rounded-[18px]" />
      </div>
    </div>
    </LoadingReveal>
  );
}
