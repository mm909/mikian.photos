import { PhotographerProvider } from "@/components/photographer/PhotographerProvider";

export const dynamic = "force-dynamic";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PhotographerProvider>{children}</PhotographerProvider>;
}
