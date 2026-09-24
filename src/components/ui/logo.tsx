import Link from "next/link";
import { Radar } from "lucide-react";
import { siteConfig } from "@/config/site";

export function Logo({ href = "/recherche" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold tracking-tight">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-white">
        <Radar className="size-4.5" />
      </span>
      <span>{siteConfig.name}</span>
    </Link>
  );
}
